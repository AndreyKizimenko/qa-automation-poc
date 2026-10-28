#!/usr/bin/env python3
"""Interactive view of the UTM test VMs — run `vm` with no arguments.

Lists every VM in inventory.tsv with its UTM state, the Fleet server its fleetd is enrolled to, and what that
server reports (online/offline, last seen, fleetd version). Enter opens a VM: start/stop it, switch fleetd
between the Fleet instances in lab.env, park/unpark. Every action runs the matching `vm` subcommand, so behaviour is identical
to the CLI. Base images are listed but read-only (never booted for testing, never enrolled).
"""
import curses
import json
import os
import subprocess
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

VM = os.path.join(os.path.dirname(os.path.realpath(__file__)), "vm")


def load_config():
    """Same lab.env lookup and defaults as the CLI: ask `vm config`."""
    out = subprocess.run([VM, "config"], capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit(out.stderr.strip() or "vm config failed")
    return dict(l.split("=", 1) for l in out.stdout.splitlines() if "=" in l)


CFG = load_config()
INV = os.path.join(CFG["VM_DATA"], "inventory.tsv")
INSTALLERS = CFG["INSTALLERS_DIR"]
SERVERS = {}  # instance -> label shown next to it (host part of its URL)
for _s in CFG["INSTANCES"].split():
    SERVERS[_s] = urlparse(CFG.get(f"INSTANCE_{_s}_URL", "")).netloc or _s
PKG = {  # (os prefix, arch) -> package suffix vm enroll looks for in $INSTALLERS_DIR/<instance>/
    ("ubuntu", "arm"): "_arm64.deb", ("debian", "arm"): "_arm64.deb",
    ("fedora", "arm"): ".aarch64.rpm", ("rhel", "arm"): ".aarch64.rpm",
    ("ubuntu", "x86"): "_amd64.deb", ("debian", "x86"): "_amd64.deb",
    ("fedora", "x86"): ".x86_64.rpm", ("rhel", "x86"): ".x86_64.rpm",
    ("mac", None): ".pkg", ("win", None): "-arm64.msi",
}
STATE_SECS = 3
# UTM answers AppleEvents one at a time; overlapping osascript calls queue up (or fail with -600)
APPLESCRIPT = threading.Lock()


def osascript(script, timeout):
    with APPLESCRIPT:
        return subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=timeout).stdout


def read_inventory():
    rows = []
    with open(INV) as f:
        header = f.readline().rstrip("\n").split("\t")
        for line in f:
            if not line.strip():
                continue
            vals = line.rstrip("\n").split("\t")
            rows.append(dict(zip(header, vals + [""] * (len(header) - len(vals)))))
    return rows


def utm_running():
    """True if the UTM app is running. Checked with pgrep, which never launches anything."""
    return subprocess.run(["pgrep", "-xq", "UTM"]).returncode == 0


def utm_states():
    """name -> started/stopped/... from the running UTM app. If UTM is closed we don't ask at all (asking would
    launch it), and no VM can be running then anyway."""
    if not utm_running():
        return {"__utm_closed__": "stopped"}
    # Ask the running app over AppleScript. Not utmctl: it lives inside UTM.app, so each run flashes a UTM icon in
    # the Dock, and this is polled every few seconds.
    script = ('tell application "UTM"\n set out to ""\n repeat with v in every virtual machine\n'
              '  set out to out & (name of v) & tab & (status of v as text) & linefeed\n end repeat\n'
              ' return out\nend tell')
    try:
        out = osascript(script, 15)
    except Exception:
        return None
    states = {}
    for line in out.splitlines():
        if "\t" in line:
            name, st = line.split("\t", 1)
            states[name] = st.strip()
    return states


def vm_ip(name):
    """IP via UTM's guest agent (AppleScript, no Dock flash); Apple-backend VMs via `vm ip` (DHCP leases, no utmctl)."""
    script = (f'tell application "UTM" to set l to query ip of virtual machine named "{name}"\n'
              'set AppleScript\'s text item delimiters to linefeed\nreturn l as text')
    try:
        out = osascript(script, 20)
    except Exception:
        out = ""
    ip = next((l.strip() for l in out.splitlines() if l.strip()[:1].isdigit() and "." in l), "")
    return ip


def ago(ts):
    try:
        t = datetime.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    except Exception:
        return "?"
    s = int((datetime.now(timezone.utc) - t).total_seconds())
    for unit, n in (("d", 86400), ("h", 3600), ("m", 60)):
        if s >= n:
            return f"{s // n}{unit} ago"
    return "just now"


def has_package(server, row):
    os_name, arch = row.get("os", ""), row.get("arch", "")
    suffix = next((v for (p, a), v in PKG.items() if os_name.startswith(p) and a in (None, arch)), None)
    d = os.path.join(INSTALLERS, server)
    if not suffix or not os.path.isdir(d):
        return False
    return any(f.startswith("fleet-osquery") and f.endswith(suffix) for f in os.listdir(d))


class Data:
    """Everything slow (UTM state, IPs, Fleet status) is fetched by background threads; the UI only reads the cache,
    so keys never wait on an AppleScript or API call."""

    def __init__(self):
        self.lock = threading.Lock()
        self.rows, self.states = read_inventory(), None   # states None until UTM has answered once
        self.fleet = {}          # server -> {hostname: (status, seen, fleetd)} or None while loading / error str
        self.fleet_at = {}
        self.ips = {}
        self._poke = threading.Event()
        threading.Thread(target=self._state_loop, daemon=True).start()
        threading.Thread(target=self._fleet_loop, daemon=True).start()
        threading.Thread(target=self._ip_loop, daemon=True).start()

    def refresh_fast(self, poll=True):
        """Re-read inventory.tsv now (a local file); poll=True also has the state thread ask UTM right away."""
        rows = read_inventory()
        with self.lock:
            self.rows = rows
        if poll:
            self._poke.set()

    def state(self, name):
        with self.lock:
            states = self.states
        if states is None:
            return "…"
        return states.get(name, "stopped" if "__utm_closed__" in states else "not in UTM")

    def _state_loop(self):
        while True:
            states = utm_states()
            if states is not None:
                with self.lock:
                    self.states = states
            self._poke.wait(STATE_SECS)
            self._poke.clear()

    def refresh_fleet_now(self):
        threading.Thread(target=self._fetch_fleet, daemon=True).start()

    def _fetch_fleet(self):
        for server in SERVERS:
            fc = CFG.get(f"INSTANCE_{server}_FLEETCTL") or "fleetctl"
            ctx = CFG.get(f"INSTANCE_{server}_CONTEXT") or server
            hosts = {}
            try:
                out = subprocess.run([fc, "get", "hosts", "--context", ctx, "--json"],
                                     capture_output=True, text=True, timeout=90).stdout
                for line in out.splitlines():
                    try:
                        spec = json.loads(line).get("spec") or {}
                    except ValueError:
                        continue
                    hn = (spec.get("hostname") or "").lower().split(".")[0]
                    if hn:
                        hosts[hn] = (spec.get("status", "?"), spec.get("seen_time", ""), spec.get("orbit_version") or "-")
                result = hosts
            except Exception as e:
                result = f"unreachable ({type(e).__name__})"
            with self.lock:
                self.fleet[server] = result
                self.fleet_at[server] = time.time()

    def _fleet_loop(self):
        while True:
            self._fetch_fleet()
            time.sleep(60)

    def _ip_loop(self):
        while True:
            with self.lock:
                rows = list(self.rows)
            running = [r["name"] for r in rows if self.state(r["name"]) == "started"]
            for name in running:
                backend = next((r.get("backend") for r in self.rows if r["name"] == name), "")
                if backend == "apple":   # no guest agent; vm ip reads DHCP leases (no utmctl involved)
                    try:
                        out = subprocess.run([VM, "ip", name], capture_output=True, text=True, timeout=20).stdout
                        ip = next((l.strip() for l in out.splitlines() if l.strip()[:1].isdigit()), "")
                    except Exception:
                        ip = ""
                else:
                    ip = vm_ip(name)
                with self.lock:
                    self.ips[name] = ip
            time.sleep(10)

    def fleet_status(self, row):
        """(text, colour) for this VM as seen by the server it's enrolled to."""
        server = row.get("server", "-")
        if row.get("role") != "host" or server not in SERVERS:
            return ("-", 0)
        with self.lock:
            hosts = self.fleet.get(server)
        if hosts is None:
            return ("loading…", 0)
        if isinstance(hosts, str):
            return (hosts, 3)
        h = hosts.get(row["name"])
        if not h:
            return ("not in Fleet", 3)
        status, seen, fleetd = h
        return (f"{status}, {ago(seen)}, fleetd {fleetd}", 1 if status == "online" else 0)


def run_vm(stdscr, args, title):
    """Leave curses, run a vm subcommand with its output visible, wait for Return, come back."""
    curses.def_prog_mode()
    curses.endwin()
    print(f"\n\033[1m── {title} ──\033[0m   (vm {' '.join(args)})\n", flush=True)
    rc = subprocess.call([VM] + args)
    print(f"\n\033[{'32' if rc == 0 else '31'}m{'done' if rc == 0 else f'failed (exit {rc})'}\033[0m"
          " — press Return to go back", flush=True)
    try:
        input()
    except EOFError:
        pass
    curses.reset_prog_mode()
    stdscr.refresh()


def draw_list(stdscr, data, items, sel):
    stdscr.erase()
    h, w = stdscr.getmaxyx()
    put = lambda y, x, s, a=0: stdscr.addnstr(y, x, s, max(0, w - x - 1), a) if 0 <= y < h else None
    put(0, 1, "UTM VMs", curses.A_BOLD)
    put(0, 10, "   ".join(f"{s} → {u}" for s, u in SERVERS.items()), curses.A_DIM)
    if "__utm_closed__" in (data.states or {}):
        put(1, 1, "UTM app is closed, so every VM is off (Start opens UTM)", curses.A_DIM)
    cols = f"  {'NAME':<16}{'OS':<10}{'STATE':<10}{'FLEETD → SERVER':<17}{'FLEET (from that server)':<38}IP"
    put(2, 1, cols, curses.A_UNDERLINE)
    y = 3
    with data.lock:
        ips = dict(data.ips)
    for i, it in enumerate(items):
        if it is None:
            put(y, 3, "── base images (read-only: never booted for testing or enrolled) ──", curses.A_DIM)
            y += 1
            continue
        st = data.state(it["name"])
        on = st == "started"
        state = ("● on" if on else "○ off" if st == "stopped" else st)
        server = it.get("server", "-")
        enrolled = f"{server:<5}{'(parked)' if it.get('active') == 'no' else ''}" if it["role"] == "host" else "-"
        ftxt, fcol = data.fleet_status(it)
        attr = curses.A_REVERSE if i == sel else 0
        line = f"{'›' if i == sel else ' '} {it['name']:<16}{it['os']:<10}{state:<10}{enrolled:<17}{ftxt:<38}{ips.get(it['name'], '') if on else ''}"
        put(y, 1, line.ljust(w - 3), attr)
        if i != sel:  # colour the state and fleet cells
            put(y, 29, state, curses.color_pair(1 if on else 0))
            if fcol:
                put(y, 56, ftxt, curses.color_pair(fcol))
        y += 1
    put(h - 1, 1, "↑↓ move  ⏎ open  i install fleetd to running  a start all  d stop all  c check  r refresh  q quit", curses.A_DIM)
    stdscr.refresh()


def actions_for(row, data):
    name, server, st = row["name"], row.get("server", "-"), data.state(row["name"])
    acts = []
    if row["role"] != "host":
        return [("Back", None, None)]
    if st == "started":
        acts.append(("Stop (clean shutdown)", ["stop", name], f"Stopping {name}"))
    else:
        # vm up waits for the IP but skips parked hosts; plain start works for those
        acts.append(("Start", ["up", name] if row.get("active") != "no" else ["start", name], f"Starting {name}"))
    for s in SERVERS:
        label = f"Switch fleetd to {s.upper()} ({SERVERS[s]})" if s != server else f"Reinstall fleetd for {s.upper()}"
        if has_package(s, row):
            acts.append((label, ["enroll", name, s], f"Enrolling {name} to {s}"))
        else:
            acts.append((label + f"  — no package in {INSTALLERS}/{s}/", None, None))
    if row.get("active") == "no":
        acts.append(("Unpark (include in start all)", ["unpark", name], f"Unparking {name}"))
    else:
        acts.append(("Park (leave out of start all)", ["park", name], f"Parking {name}"))
    acts.append(("Back", None, None))
    return acts


def detail(stdscr, data, row):
    sel = 0
    while True:
        with data.lock:
            rows = list(data.rows)
        row = next((r for r in rows if r["name"] == row["name"]), row)
        acts = actions_for(row, data)
        sel = min(sel, len(acts) - 1)
        stdscr.erase()
        h, w = stdscr.getmaxyx()
        put = lambda y, x, s, a=0: stdscr.addnstr(y, x, s, max(0, w - x - 1), a) if 0 <= y < h else None
        st = data.state(row["name"])
        server = row.get("server", "-")
        ftxt, fcol = data.fleet_status(row)
        put(0, 1, row["name"], curses.A_BOLD)
        put(0, 3 + len(row["name"]), f"{row.get('purpose', '')}", curses.A_DIM)
        put(2, 3, f"OS        {row['os']} ({row['arch']}, {row['backend']})")
        put(3, 3, "State     "); put(3, 13, "● on" if st == "started" else "○ off" if st == "stopped" else st,
                                     curses.color_pair(1 if st == "started" else 0))
        if st == "started":
            put(3, 20, data.ips.get(row["name"], ""), curses.A_DIM)
        if row["role"] == "host":
            put(4, 3, f"fleetd    {server}" + (f"  → {SERVERS[server]}" if server in SERVERS else "  (not enrolled)"))
            put(5, 3, "Fleet     "); put(5, 13, ftxt, curses.color_pair(fcol))
        else:
            put(4, 3, "Base image: clone it (vm clone) to test; don't start or enroll it.", curses.A_DIM)
        for i, (label, args, _) in enumerate(acts):
            disabled = args is None and label != "Back"
            a = curses.A_REVERSE if i == sel else (curses.A_DIM if disabled else 0)
            put(7 + i, 3, f"{'›' if i == sel else ' '} {label}", a)
        put(h - 1, 1, "↑↓ move  ⏎ run  ← / esc back  q quit", curses.A_DIM)
        stdscr.refresh()
        k = stdscr.getch()
        if k in (curses.KEY_UP, ord("k")):
            sel = (sel - 1) % len(acts)
        elif k in (curses.KEY_DOWN, ord("j")):
            sel = (sel + 1) % len(acts)
        elif k in (curses.KEY_LEFT, 27, ord("b")):
            return True
        elif k == ord("q"):
            return False
        elif k in (10, 13, curses.KEY_ENTER, curses.KEY_RIGHT):
            label, args, title = acts[sel]
            if label == "Back":
                return True
            if args:
                run_vm(stdscr, args, title)
                data.refresh_fast()
                if args[0] == "enroll":
                    data.refresh_fleet_now()


def install_dialog(stdscr, data):
    """'i': pick an instance, see which running test VMs get it, Enter installs to all of them (vm install)."""
    sel = 0
    servers = list(SERVERS)
    while True:
        with data.lock:
            rows = list(data.rows)
        server = servers[sel]
        running = [r for r in rows if r["role"] == "host" and data.state(r["name"]) == "started"]
        targets = [(r, has_package(server, r)) for r in running]
        ready = [r for r, ok in targets if ok]
        h, w = stdscr.getmaxyx()
        top = 3 + len(servers)   # first row below the instance list
        bh, bw = min(h - 2, top + 7 + len(targets)), min(w - 4, 78)
        win = curses.newwin(bh, bw, max(0, (h - bh) // 2), max(0, (w - bw) // 2))
        win.erase(); win.box()
        put = lambda y, x, t, a=0: win.addnstr(y, x, t, max(0, bw - x - 2), a) if 0 < y < bh - 1 else None
        put(0, 2, " Install fleetd to all running VMs ", curses.A_BOLD)
        for i, s in enumerate(servers):
            label = f"{s.upper():<5} {SERVERS[s]}"
            put(2 + i, 3, f"{'›' if i == sel else ' '} {label}", curses.A_REVERSE if i == sel else 0)
        put(top, 3, "Running test VMs:", curses.A_UNDERLINE)
        if not targets:
            put(top + 1, 5, "none running. Start some first (a = start all).", curses.A_DIM)
        for j, (r, ok) in enumerate(targets):
            now = r.get("server", "-")
            change = f"{now} → {server}" if now != server else f"{server} (reinstall)"
            note = "ready" if ok else f"skip: none in installers/{server}/"
            put(top + 1 + j, 5, f"{r['name']:<16}{change:<18}", 0)
            put(top + 1 + j, 39, note, curses.color_pair(1 if ok else 3))
        hint = (f"⏎ install to {len(ready)} VM{'s' if len(ready) != 1 else ''}" if ready else "nothing to install") \
            + "   ↑↓ server   esc cancel"
        put(bh - 2, 3, hint, curses.A_DIM)
        win.refresh()
        k = stdscr.getch()
        if k in (curses.KEY_UP, ord("k")):
            sel = (sel - 1) % len(servers)
        elif k in (curses.KEY_DOWN, ord("j")):
            sel = (sel + 1) % len(servers)
        elif k in (27, ord("q"), curses.KEY_LEFT):
            return
        elif k in (10, 13, curses.KEY_ENTER) and ready:
            if len(ready) == len(running):
                run_vm(stdscr, ["install", server], f"Installing {server.upper()} fleetd on {len(ready)} running VMs")
            else:   # some have no package for this server: enroll just the ready ones (still one window, in parallel)
                names = " ".join(r["name"] for r in ready)
                run_vm(stdscr, ["_enroll_some", server] + [r["name"] for r in ready],
                       f"Installing {server.upper()} fleetd on {names}")
            data.refresh_fast(); data.refresh_fleet_now()
            return


def main(stdscr):
    curses.curs_set(0)
    curses.use_default_colors()
    curses.init_pair(1, curses.COLOR_GREEN, -1)
    curses.init_pair(3, curses.COLOR_YELLOW, -1)
    stdscr.timeout(1000)  # redraw every second so background updates show up
    data = Data()
    sel, last = 0, 0.0
    while True:
        if last == 0:
            data.refresh_fast()                 # after an action: poll UTM now
        elif time.time() - last > 3:
            data.refresh_fast(poll=False)       # the state thread polls UTM on its own
            last = time.time()
        hosts = [r for r in data.rows if r["role"] == "host"]
        goldens = [r for r in data.rows if r["role"] != "host"]
        items = hosts + ([None] if goldens else []) + goldens
        selectable = [i for i, it in enumerate(items) if it is not None]
        if not selectable:
            return
        if sel not in selectable:
            sel = selectable[0]
        draw_list(stdscr, data, items, sel)
        k = stdscr.getch()
        pos = selectable.index(sel)
        if k in (curses.KEY_UP, ord("k")):
            sel = selectable[(pos - 1) % len(selectable)]
        elif k in (curses.KEY_DOWN, ord("j")):
            sel = selectable[(pos + 1) % len(selectable)]
        elif k in (10, 13, curses.KEY_ENTER, curses.KEY_RIGHT):
            if not detail(stdscr, data, items[sel]):
                return
            last = 0
        elif k == ord("a"):
            run_vm(stdscr, ["up"], "Starting all active hosts"); last = 0
        elif k == ord("d"):
            run_vm(stdscr, ["down"], "Stopping all running hosts"); last = 0
        elif k == ord("c"):
            run_vm(stdscr, ["check"], "vm check"); last = 0
        elif k == ord("i"):
            install_dialog(stdscr, data); last = 0
        elif k == ord("r"):
            data.refresh_fleet_now(); last = 0
        elif k == ord("q"):
            return


if __name__ == "__main__":
    os.environ.setdefault("ESCDELAY", "25")
    curses.wrapper(main)
