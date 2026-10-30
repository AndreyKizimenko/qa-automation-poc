#!/usr/bin/env -S python3 -I
"""Interactive view for loglab — run `loglab` with no arguments.

Top: each Fleet instance from lab.env — up/down, version, and per log type the destination in loglab's config file,
green when the running server already uses it, yellow when a restart (or Hangar wiring) is still needed.
Enter on an instance → pick a destination and which log types; it runs `loglab switch` in the terminal so the
pre-flight, validation and confirmation are identical to the CLI. t test · v view (Ctrl-C returns here).
Bottom: the local sinks — Enter to start/stop.
"""
import curses
import json
import os
import shutil
import signal
import subprocess
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
LOGLAB = os.path.join(ROOT, "bin", "loglab")
TYPES = ("result", "status", "audit")
POLL_SECS = 30   # 2 API calls per instance per poll


class Data:
    def __init__(self):
        self.lock = threading.Lock()
        self.st, self.at, self.err = None, 0.0, ""
        self.refresh_now()
        threading.Thread(target=self._loop, daemon=True).start()

    def refresh_now(self):
        threading.Thread(target=self._fetch, daemon=True).start()

    def _fetch(self):
        try:
            out = subprocess.run([LOGLAB, "status", "--json"], capture_output=True, text=True, timeout=120)
            st, err = json.loads(out.stdout), ""
        except Exception as e:
            st, err = None, f"loglab status failed ({type(e).__name__})"
        with self.lock:
            if st is not None:
                self.st = st
            self.err, self.at = err, time.time()

    def _loop(self):
        while True:
            time.sleep(POLL_SECS)
            self._fetch()

    def get(self):
        with self.lock:
            return self.st, self.err


def run_cmd(stdscr, args, title, interruptible=False):
    """Leave curses, run a loglab subcommand with its prompts/output visible, wait for Return, come back.
    Ctrl-C stops the child only (views run until interrupted)."""
    curses.def_prog_mode()
    curses.endwin()
    hint = "   Ctrl-C to stop" if interruptible else ""
    print(f"\n\033[1m── {title} ──\033[0m   (loglab {' '.join(args)}){hint}\n", flush=True)
    old = signal.signal(signal.SIGINT, signal.SIG_IGN)
    try:
        p = subprocess.Popen([LOGLAB] + args, preexec_fn=lambda: signal.signal(signal.SIGINT, signal.SIG_DFL))
        rc = p.wait()
    finally:
        signal.signal(signal.SIGINT, old)
    done = rc == 0 or (interruptible and rc in (130, -2))
    print(f"\n\033[{'32' if done else '31'}m{'done' if done else f'failed (exit {rc})'}\033[0m"
          " — press Return to go back", flush=True)
    try:
        input()
    except (EOFError, KeyboardInterrupt):
        pass
    curses.reset_prog_mode()
    stdscr.refresh()


HDR = "__header__"


def menu(stdscr, title, subtitle, opts):
    """opts: [(label, value or None=disabled or HDR=section header)] -> value, or None on back. Last option: Back."""
    movable = [i for i, (_, v) in enumerate(opts) if v != HDR]
    sel = next((i for i in movable if opts[i][1] is not None), movable[0])
    while True:
        stdscr.erase()
        h, w = stdscr.getmaxyx()
        put = lambda y, x, s, a=0: stdscr.addnstr(y, x, s, max(0, w - x - 1), a) if 0 <= y < h else None
        put(0, 1, title, curses.A_BOLD)
        for j, line in enumerate(subtitle):
            put(2 + j, 3, line, curses.A_DIM)
        y = 3 + len(subtitle)
        for i, (label, val) in enumerate(opts):
            if val == HDR:
                y += 1 if i else 0
                put(y, 3, label, curses.A_BOLD | curses.A_UNDERLINE)
            else:
                a = curses.A_REVERSE if i == sel else (curses.A_DIM if val is None and label != "Back" else 0)
                put(y, 3, f"{'›' if i == sel else ' '} {label}", a)
            y += 1
        put(h - 1, 1, "↑↓ move  ⏎ choose  ← / esc back", curses.A_DIM)
        stdscr.refresh()
        k = stdscr.getch()
        pos = movable.index(sel)
        if k in (curses.KEY_UP, ord("k")):
            sel = movable[(pos - 1) % len(movable)]
        elif k in (curses.KEY_DOWN, ord("j")):
            sel = movable[(pos + 1) % len(movable)]
        elif k in (curses.KEY_LEFT, 27, ord("b"), ord("q")):
            return None
        elif k in (10, 13, curses.KEY_ENTER, curses.KEY_RIGHT):
            label, val = opts[sel]
            if label == "Back":
                return None
            if val is not None:
                return val


STATE_COLOR = {"applied": 1, "down": 2, "restart": 3, "unwired": 3, "attention": 3}
STATE_TEXT = {"applied": "live", "down": "Fleet down", "restart": "restart needed", "unwired": "wire in Hangar",
              "attention": "check"}


def draw(stdscr, data, items, sel):
    stdscr.erase()
    h, w = stdscr.getmaxyx()
    put = lambda y, x, s, a=0: stdscr.addnstr(y, x, s, max(0, w - x - 1), a) if 0 <= y < h else None
    st, err = data.get()
    put(0, 1, "Log lab", curses.A_BOLD)
    put(0, 10, "where each Fleet instance sends osquery result/status logs and audit logs", curses.A_DIM)
    if st is None:
        put(2, 3, err or "loading…", curses.A_DIM)
        stdscr.refresh()
        return
    put(2, 1, f"  {'INSTANCE':<10}{'VERSION':<13}{'DESTINATION':<20}STATE", curses.A_UNDERLINE)
    y = 3
    sel_inst = None
    for i, (kind, obj) in enumerate(items):
        mark = "›" if i == sel else " "
        attr = curses.A_REVERSE if i == sel else 0
        if kind == "sep":
            y += 1
            put(y, 1, f"  {'SINK':<12}{'STATE':<10}{'PORT':<8}{'USED BY':<22}WHAT", curses.A_UNDERLINE)
            y += 1
            continue
        if kind == "inst":
            s = obj
            if i == sel:
                sel_inst = s
            ver = s["version"][:12] if s["up"] else "-"
            dest = current_dest(s)[:19]
            line = f"{mark} {s['name']:<10}{ver:<13}{dest:<20}{STATE_TEXT[s['state']]}"
            put(y, 1, line.ljust(w - 3), attr)
            if i != sel:
                ok = all(s["types"][t]["applied"] for t in TYPES)
                put(y, 26, dest, curses.color_pair(1 if ok else 3 if s["up"] else 0))
                put(y, 46, STATE_TEXT[s["state"]], curses.color_pair(STATE_COLOR[s["state"]]))
        else:
            sv = obj
            pairs = [u.split(":") for d in st["destinations"] if d["service"] == sv["key"] for u in d["used_by"]]
            by = {}
            for i_, t_ in pairs:
                by.setdefault(i_, set()).add(t_)
            used = " ".join(i_ if len(ts) == 3 else f"{i_}:{'+'.join(sorted(ts))}" for i_, ts in sorted(by.items()))
            line = f"{mark} {sv['key']:<12}{sv['state']:<10}{sv['port']:<8}{used[:21]:<22}{sv['what']}"
            put(y, 1, line.ljust(w - 3), attr)
            if i != sel:
                put(y, 15, sv["state"], curses.color_pair(1 if sv["state"] == "running" else 3 if used else 0))
        y += 1
    y += 1
    focus = sel_inst or next((o for k, o in items if k == "inst"), None)
    if focus:
        put(y, 3, f"{focus['name']} next: ", curses.A_BOLD)
        put(y, 3 + len(focus["name"]) + 7, focus["next"][:w - 14],
            curses.color_pair(STATE_COLOR[focus["state"]]) | curses.A_BOLD)
        y += 1
        put(y, 3, f"sending now: " + "  ".join(f"{t}={focus['types'][t]['live'] or '-'}" for t in TYPES), curses.A_DIM)
        y += 1
        for p in focus["pending"][1:4]:
            put(y, 3, f"! {p}"[:w - 6], curses.color_pair(3))
            y += 1
    for d in st["destinations"]:
        if d["used_by"] and d["service"] not in ("", "cloud") and d["state"] != "running":
            put(y, 3, f"! {', '.join(d['used_by'])} → {d['key']}, but {d['service']} is {d['state']}", curses.color_pair(2))
            y += 1
    age = int(time.time() - data.at)
    put(h - 1, 1, f"↑↓ move  ⏎ switch/start-stop  f fire test logs  v view logs  t test  s yaml  e env rows  "
                  f"h hangar wiring  r refresh ({age}s ago)  q quit", curses.A_DIM)
    stdscr.refresh()


GROUPS = [
    ("No setup", ["filesystem", "stdout", "webhook", "splunk"]),
    ("Local emulators (start automatically)", ["kinesis", "firehose", "kafkarest", "nats", "pubsub", "splunk-local"]),
    ("Real cloud (SECRETS.env)", ["splunk-cloud", "kinesis-aws", "firehose-aws", "lambda-aws"]),
]


def current_dest(s):
    """The one destination all log types use, or 'mixed' (only possible via the advanced page / --only)."""
    vals = {s["types"][t]["configured"] for t in TYPES}
    if len(vals) == 1:
        return vals.pop()
    # webhook takes result + status only; its audit sitting on default still counts as "webhook"
    rs = {s["types"][t]["configured"] for t in ("result", "status")}
    if len(rs) == 1 and s["types"]["audit"]["configured"] == "default":
        return rs.pop()
    return "mixed"


def dest_options(st, s, mark_current):
    inst = s["name"]
    by = {d["key"]: d for d in st["destinations"]}
    opts = []
    for title, keys in GROUPS:
        ds = [by[k] for k in keys if k in by]
        if all(d["state"] == "no secrets" for d in ds):
            opts += [(title, HDR), (f"Fill {os.path.join(st.get('data', '$LOGLAB_DATA'), 'SECRETS.env')} to enable "
                                    "AWS Kinesis / Firehose / Lambda and a real Splunk HEC", None)]
            continue
        opts.append((title, HDR))
        for d in ds:
            if not d["supported"][inst]:
                opts.append((f"{d['name']:<34}not in {inst}'s build", None))
                continue
            if d["state"] == "no secrets":
                opts.append((f"{d['name']:<34}fill SECRETS.env first", None))
                continue
            note = "  (result + status; Fleet has no audit webhook → audit off)" if len(d["types"]) < 3 else ""
            tag = "  ← current" if mark_current(d["key"]) else ""
            opts.append((f"{d['name']:<34}{tag}{note}", d["key"]))
    return opts


def switch_flow(stdscr, data, s):
    st, _ = data.get()
    inst = s["name"]
    cur = current_dest(s)
    opts = dest_options(st, s, lambda k: k == cur)
    opts += [("", HDR), ("Default — Fleet built-in (filesystem in $TMPDIR, audit off)", "default"),
             ("Advanced — send result / status / audit to different destinations …", "advanced"), ("Back", None)]
    dest = menu(stdscr, f"Switch {inst}'s log destination (result, status and audit together)",
                [f"now: {cur}" + ("" if cur != "mixed" else "  — " + ", ".join(
                    f"{t}={s['types'][t]['configured']}" for t in TYPES))], opts)
    if not dest:
        return
    if dest == "advanced":
        return advanced_flow(stdscr, data, s)
    run_cmd(stdscr, ["switch", inst, dest], f"Switching {inst} to {dest}")
    data.refresh_now()


def advanced_flow(stdscr, data, s):
    """Per-log-type switching (loglab switch --only)."""
    st, _ = data.get()
    inst = s["name"]
    cur = ", ".join(f"{t}={s['types'][t]['configured']}" for t in TYPES)
    scope = menu(stdscr, f"Advanced: {inst} per log type", [f"now: {cur}", "Which log type do you want to move?"],
                 [(f"{t.capitalize():<8} now {s['types'][t]['configured']}", t) for t in TYPES] + [("Back", None)])
    if not scope:
        return
    by = {d["key"]: d for d in st["destinations"]}
    opts = []
    for lbl, val in dest_options(st, s, lambda k: s["selection"][scope] == k):
        if val in by and scope not in by[val]["types"]:
            opts.append((f"{by[val]['name']:<34}can't take {scope} logs", None))
        else:
            opts.append((lbl.split("  (result + status")[0], val))
    opts += [("", HDR), ("Default — Fleet built-in", "default"), ("Back", None)]
    dest = menu(stdscr, f"Advanced: {inst} {scope} logs →", [f"other types stay where they are ({cur})"], opts)
    if not dest:
        return
    run_cmd(stdscr, ["switch", inst, dest, "--only", scope], f"Switching {inst} {scope} logs to {dest}")
    data.refresh_now()


def vm_hosts(inst):
    """Active test VMs enrolled to inst, from the vm tool's inventory (`vm config VM_DATA`); [] without vm."""
    if not shutil.which("vm"):
        return []
    try:
        out = subprocess.run(["vm", "config", "VM_DATA"], capture_output=True, text=True, timeout=20)
        d = os.path.expanduser(out.stdout.strip().splitlines()[-1]) if out.returncode == 0 and out.stdout.strip() else ""
        with open(os.path.join(d or "/nonexistent", "inventory.tsv")) as f:
            header = f.readline().rstrip("\n").split("\t")
            rows = [dict(zip(header, l.rstrip("\n").split("\t"))) for l in f if l.strip()]
    except (OSError, subprocess.SubprocessError):
        return []
    return [r.get("name") for r in rows if r.get("role") == "host" and r.get("active") == "yes" and r.get("server") == inst]


def fire_flow(stdscr, data, s):
    inst = s["name"]
    if not s["up"]:
        menu(stdscr, f"{inst} is down", [s["next"]], [("Back", None)])
        return
    opts = [("Result + audit logs (temporary report on every host, ~1–2 min; watch 4 min, then delete it)", []),
            ("Audit only via the API (create + delete a report that never runs; arrives in ≤ ~6 min)", ["--audit"])]
    opts += [(f"…plus status logs: restart osquery on {v}", ["--status-from", v]) for v in vm_hosts(inst)]
    opts.append(("Back", None))
    sub = [f"logs go to: " + ", ".join(f"{t}={s['types'][t]['live'] or '-'}" for t in TYPES)]
    if s["state"] != "applied":
        sub.append(f"! {s['next']}")
    extra = menu(stdscr, f"Fire test logs on {inst}", sub, opts)
    if extra is None:
        return
    run_cmd(stdscr, ["fire", inst] + extra, f"Firing test logs on {inst}", interruptible=True)
    data.refresh_now()


def sink_flow(stdscr, data, sv):
    opts = [("Start (creates every instance's streams/topics)", ["up", sv["key"]]), ("Stop", ["down", sv["key"]]), ("Back", None)]
    if sv["state"] == "running":
        opts[0] = ("Re-provision streams/topics (restart-safe)", ["up", sv["key"]])
    args = menu(stdscr, sv["key"], [sv["what"], f"127.0.0.1:{sv['port']}  state: {sv['state']}"
                                    + (f"  memory cap {sv['mem']} MB" if sv["mem"] else "")], opts)
    if args:
        run_cmd(stdscr, args, f"{sv['key']}: {' '.join(args)}")
        data.refresh_now()


def main(stdscr):
    curses.curs_set(0)
    curses.use_default_colors()
    curses.init_pair(1, curses.COLOR_GREEN, -1)
    curses.init_pair(2, curses.COLOR_RED, -1)
    curses.init_pair(3, curses.COLOR_YELLOW, -1)
    stdscr.timeout(1000)
    data = Data()
    sel = 0
    while True:
        st, _ = data.get()
        items = []
        if st:
            items = [("inst", s) for s in st["instances"]] + [("sep", None)] + [("svc", s) for s in st["services"]]
        selectable = [i for i, it in enumerate(items) if it[0] != "sep"]
        if selectable and sel not in selectable:
            sel = selectable[0]
        draw(stdscr, data, items, sel)
        k = stdscr.getch()
        if not selectable:
            if k == ord("q"):
                return
            continue
        pos = selectable.index(sel)
        kind, obj = items[sel]
        inst = obj["name"] if kind == "inst" else None
        if k in (curses.KEY_UP, ord("k")):
            sel = selectable[(pos - 1) % len(selectable)]
        elif k in (curses.KEY_DOWN, ord("j")):
            sel = selectable[(pos + 1) % len(selectable)]
        elif k in (10, 13, curses.KEY_ENTER, curses.KEY_RIGHT):
            switch_flow(stdscr, data, obj) if kind == "inst" else sink_flow(stdscr, data, obj)
        elif k == ord("f") and inst:
            fire_flow(stdscr, data, obj)
        elif k == ord("t") and inst:
            run_cmd(stdscr, ["test", inst], f"Testing {inst}")
            data.refresh_now()
        elif k == ord("v") and inst:
            run_cmd(stdscr, ["view", inst], f"{inst} logs at their destination", interruptible=True)
        elif k == ord("s") and inst:
            run_cmd(stdscr, ["show", inst], f"{inst} config file")
        elif k == ord("e") and inst:
            run_cmd(stdscr, ["env", inst], f"{inst} as FLEET_* env rows")
        elif k == ord("h"):
            run_cmd(stdscr, ["hangar"], "Hangar wiring")
        elif k == ord("r"):
            data.refresh_now()
        elif k == ord("q"):
            return


if __name__ == "__main__":
    os.environ.setdefault("ESCDELAY", "25")
    curses.wrapper(main)
