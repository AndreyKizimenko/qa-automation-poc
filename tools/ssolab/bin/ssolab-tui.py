#!/usr/bin/env python3
"""Interactive view for ssolab — run `ssolab` with no arguments.

Top: each Fleet instance (INSTANCES in lab.env) — up/down, version, license, which IdP admin SSO and end-user auth point at.
Enter on an instance → pick a provider (or Off) and what to switch; it runs `ssolab switch` in the terminal so the
pre-flight, confirmation, verification and the optional GitOps write are identical to the CLI.
Bottom: providers — Enter for setup, SP values, logins, start/stop for the self-hosted ones.
"""
import curses
import importlib.machinery
import importlib.util
import json
import os
import subprocess
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
SSO = os.path.join(ROOT, "bin", "ssolab")
FEAT = {"sso": "Admin SSO", "eua": "End-user auth"}
REVEAL_SECS, CLIPBOARD_SECS = 30, 45


def cli():
    """The ssolab CLI as a module (read_logins etc.), so the logins view parses LOGINS.md exactly like the CLI."""
    loader = importlib.machinery.SourceFileLoader("ssolab_cli", SSO)
    spec = importlib.util.spec_from_loader("ssolab_cli", loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


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
            out = subprocess.run([SSO, "status", "--json"], capture_output=True, text=True, timeout=90)
            st, err = json.loads(out.stdout), ""
        except Exception as e:
            st, err = None, f"ssolab status failed ({type(e).__name__})"
        with self.lock:
            if st is not None:
                self.st = st
            self.err, self.at = err, time.time()

    def _loop(self):
        while True:
            time.sleep(120)   # each poll is 3 requests per instance; keep Fleet's debug log quiet
            self._fetch()

    def get(self):
        with self.lock:
            return self.st, self.err


def run_sso(stdscr, args, title):
    """Leave curses, run an sso subcommand with its prompts/output visible, wait for Return, come back."""
    curses.def_prog_mode()
    curses.endwin()
    print(f"\n\033[1m── {title} ──\033[0m   (ssolab {' '.join(args)})\n", flush=True)
    rc = subprocess.call([SSO] + args)
    print(f"\n\033[{'32' if rc == 0 else '31'}m{'done' if rc == 0 else f'failed (exit {rc})'}\033[0m"
          " — press Return to go back", flush=True)
    try:
        input()
    except EOFError:
        pass
    curses.reset_prog_mode()
    stdscr.refresh()


def describe(sec, feat, provs):
    names = {p["key"]: p["name"] for p in provs}
    if feat == "sso" and not sec.get("enabled"):
        return ("off", 0)
    if not sec.get("entity_id"):
        return ("off", 0)
    p = sec.get("provider")
    return (names.get(p, p), 1) if p else (f"{sec.get('idp_name') or '?'} (unsaved)", 3)


def ready_text(p):
    parts = [f"{i}:{'+'.join(fs)}" for i, fs in p["ready"].items() if fs]
    return "  ".join(parts) if parts else "not set up"


def draw(stdscr, data, items, sel):
    stdscr.erase()
    h, w = stdscr.getmaxyx()
    put = lambda y, x, s, a=0: stdscr.addnstr(y, x, s, max(0, w - x - 1), a) if 0 <= y < h else None
    st, err = data.get()
    put(0, 1, "SSO lab", curses.A_BOLD)
    put(0, 10, "which IdP each Fleet instance uses for admin SSO + MDM end-user auth", curses.A_DIM)
    if st is None:
        put(2, 3, err or "loading…", curses.A_DIM)
        stdscr.refresh()
        return
    provs = st["providers"]
    put(2, 1, f"  {'INSTANCE':<10}{'STATE':<7}{'VERSION':<13}{'LICENSE':<9}{'ADMIN SSO':<26}{'END-USER AUTH':<26}PUBLIC URL",
        curses.A_UNDERLINE)
    y = 3
    for i, it in enumerate(items):
        kind, obj = it
        if kind == "sep":
            y += 1
            put(y, 1, f"  {'PROVIDER':<12}{'IdP NAME':<27}{'SERVICE':<10}{'READY FOR':<30}LOGINS", curses.A_UNDERLINE)
            y += 1
            continue
        mark = "›" if i == sel else " "
        attr = curses.A_REVERSE if i == sel else 0
        if kind == "inst":
            s = obj
            if not s["up"]:
                put(y, 1, f"{mark} {s['name']:<10}{'down':<7}{s.get('error', '')}".ljust(w - 3), attr)
                if i != sel:
                    put(y, 13, "down", curses.color_pair(2))
            else:
                a, ac = describe(s["sso"], "sso", provs)
                e, ec = describe(s["eua"], "eua", provs)
                line = f"{mark} {s['name']:<10}{'up':<7}{s['version'][:12]:<13}{s['license']:<9}{a[:25]:<26}{e[:25]:<26}{s['public']}"
                put(y, 1, line.ljust(w - 3), attr)
                if i != sel:
                    put(y, 13, "up", curses.color_pair(1))
                    put(y, 42, a[:25], curses.color_pair(ac))
                    put(y, 68, e[:25], curses.color_pair(ec))
        else:
            p = obj
            svc = p["service"] or "cloud"
            rt = ready_text(p)
            put(y, 1, f"{mark} {p['key']:<12}{p['idp_name'][:26]:<27}{svc:<10}{rt[:29]:<30}{p['creds']}".ljust(w - 3), attr)
            if i != sel:
                put(y, 42, svc, curses.color_pair({"running": 1, "stopped": 3}.get(svc, 0)))
                put(y, 52, rt[:29], curses.color_pair(0 if any(p["ready"].values()) else 3))
        y += 1
    y += 1
    if not st.get("gitops_file", True):
        put(y, 3, "GitOps: off (SSOLAB_GITOPS_DEFAULT isn't set in lab.env)", curses.A_DIM)
    elif st.get("gitops"):
        put(y, 3, f"GitOps: default.yml carries IdP settings from {st['gitops']} — applies to both servers on the next gitops run",
            curses.color_pair(3))
    else:
        put(y, 3, "GitOps: default.yml has no sso_settings — a gitops run resets SSO + end-user auth to empty", curses.A_DIM)
    age = int(time.time() - data.at)
    put(h - 1, 1, f"↑↓ move  ⏎ open  n new user  t test  w why  l logins  s 1Password sync  g gitops  r refresh ({age}s ago)  q quit", curses.A_DIM)
    stdscr.refresh()


def menu(stdscr, title, subtitle, opts):
    """opts: [(label, value or None=disabled)] -> value, or None on back. Last option should be Back."""
    sel = 0
    while True:
        stdscr.erase()
        h, w = stdscr.getmaxyx()
        put = lambda y, x, s, a=0: stdscr.addnstr(y, x, s, max(0, w - x - 1), a) if 0 <= y < h else None
        put(0, 1, title, curses.A_BOLD)
        for j, line in enumerate(subtitle):
            put(2 + j, 3, line, curses.A_DIM)
        top = 3 + len(subtitle)
        for i, (label, val) in enumerate(opts):
            a = curses.A_REVERSE if i == sel else (curses.A_DIM if val is None and label != "Back" else 0)
            put(top + i, 3, f"{'›' if i == sel else ' '} {label}", a)
        put(h - 1, 1, "↑↓ move  ⏎ choose  ← / esc back", curses.A_DIM)
        stdscr.refresh()
        k = stdscr.getch()
        if k in (curses.KEY_UP, ord("k")):
            sel = (sel - 1) % len(opts)
        elif k in (curses.KEY_DOWN, ord("j")):
            sel = (sel + 1) % len(opts)
        elif k in (curses.KEY_LEFT, 27, ord("b"), ord("q")):
            return None
        elif k in (10, 13, curses.KEY_ENTER, curses.KEY_RIGHT):
            label, val = opts[sel]
            if label == "Back":
                return None
            if val is not None:
                return val


def switch_flow(stdscr, data, s):
    st, _ = data.get()
    inst = s["name"]
    if not s["up"]:
        menu(stdscr, f"{inst} is down", [s.get("error", ""), "Start that Fleet server (or fix its context), then r to refresh."], [("Back", None)])
        return
    cur = {"sso": s["sso"].get("provider") if s["sso"].get("enabled") else None, "eua": s["eua"].get("provider")}
    opts = []
    for p in st["providers"]:
        fs = p["ready"][inst]
        now = [FEAT[f] for f in fs if cur[f] == p["key"]]
        tag = "  ← current" + (f" ({', '.join(now)})" if len(now) < 2 else "") if now else ""
        if fs:
            extra = "" if p["service"] in ("", "running") else f"  — {p['service']}, starts on demand"
            opts.append((f"{p['name']:<28}{'+'.join(FEAT[f] for f in fs)}{extra}{tag}", p["key"]))
        else:
            opts.append((f"{p['name']:<28}not set up for {inst} (Enter on it below → Set up)", None))
    opts += [("Off (disable admin SSO, clear end-user IdP)", "off"), ("Back", None)]
    a, _ = describe(s["sso"], "sso", st["providers"])
    e, _ = describe(s["eua"], "eua", st["providers"])
    p = menu(stdscr, f"Switch {inst}'s IdP", [f"{s['public']}   now: admin SSO {a}, end-user auth {e}"], opts)
    if not p:
        return
    prov = next((x for x in st["providers"] if x["key"] == p), None)
    fs = prov["ready"][inst] if prov else list(FEAT)
    scope_opts = []
    if len(fs) == 2:
        scope_opts.append(("Admin SSO + end-user auth", []))
    for f in fs:
        scope_opts.append((f"{FEAT[f]} only", ["--only", f]))
    scope_opts.append(("Back", None))
    name = prov["name"] if prov else "Off"
    scope = menu(stdscr, f"{inst} → {name}", ["What should point at it?"], scope_opts)
    if scope is None:
        return
    if prov and prov["service"] == "stopped":
        run_sso(stdscr, [p, "up"], f"Starting {name}")
    run_sso(stdscr, ["switch", inst, p] + scope, f"Switching {inst} to {name}")
    data.refresh_now()


def provider_flow(stdscr, data, p):
    k = p["key"]
    opts = []
    if k == "saml":
        opts += [("Start / restart — re-reads every instance's URL into the IdP's list of trusted Fleet apps (ssolab saml up)",
                  ["saml", "up"]), ("Stop", ["saml", "down"])]
    elif k == "authentik":
        opts += [("Start + provision the 4 SAML apps (ssolab authentik up)", ["authentik", "up"]),
                 ("Re-provision apps (after a server URL change)", ["authentik", "provision"]),
                 ("Add / reset a test user", ["authentik", "user"]), ("Stop", ["authentik", "down"])]
    elif k == "entra":
        opts += [("Connect + provision the 4 SAML apps via Microsoft Graph (ssolab entra connect)", ["entra", "connect"]),
                 ("Re-provision apps (after a server URL change)", ["entra", "provision"]),
                 ("Tenant MFA (security defaults) status — change: ssolab entra mfa on|off", ["entra", "mfa"]),
                 ("Set up by hand instead", ["setup", k, "--manual"])]
    elif k == "auth0":
        opts += [("Connect + provision the 4 SAML apps via the Management API (ssolab auth0 connect)", ["auth0", "connect"]),
                 ("Re-provision apps (after a server URL change)", ["auth0", "provision"])]
    elif k == "okta":
        opts += [("Connect + provision the 4 SAML apps via the Okta API (ssolab okta connect)", ["okta", "connect"]),
                 ("Re-provision apps (after a server URL change)", ["okta", "provision"]),
                 ("Add / reset a test user (Okta + Fleet; asks whether to require Okta Verify)", ["okta", "user"]),
                 ("Show which users need Okta Verify (change: ssolab okta mfa <email> on|off)", ["okta", "mfa"]),
                 ("Set up by hand instead (no API token)", ["setup", k, "--manual"])]
    else:
        opts.append(("Set up / edit the IdP apps (ssolab setup)", ["setup", k]))
    opts += [("Show SP values to paste into the IdP", ["sp", k]),
             ("New user — IdP + Fleet account, all options on one screen", "newuser"),
             ("Logins — browse, reveal, copy", "logins"),
             ("Add a tenant/admin login (not a Fleet user)", ["creds", "add", k]),
             ("Back", None)]
    info = [f"ready for: {ready_text(p)}", f"JIT provisioning on switch: {'on' if p['jit'] else 'off'}   logins saved: {p['creds']}"]
    while True:
        args = menu(stdscr, p["name"], info, opts)
        if not args:
            return
        if args == "logins":
            logins_view(stdscr, data, k)
            continue
        if args == "newuser":
            new_user_form(stdscr, data, k)
            continue
        run_sso(stdscr, args, f"{p['name']}: {' '.join(args)}")
        data.refresh_now()


def edit_line(stdscr, y, x, value, width, mask=False):
    """Inline text editor. ⏎ keeps, esc cancels (-> None). Unicode-safe (fleet names have emoji)."""
    curses.curs_set(1)
    buf = list(value)
    try:
        while True:
            shown = ("•" * len(buf)) if mask else "".join(buf)
            stdscr.addnstr(y, x, shown[-(width - 1):].ljust(width - 1), width - 1, curses.A_UNDERLINE)
            stdscr.move(y, x + min(len(shown), width - 1))
            stdscr.refresh()
            try:
                ch = stdscr.get_wch()
            except curses.error:
                continue          # 1 s timeout tick
            if ch in ("\n", "\r", curses.KEY_ENTER, 10, 13):
                return "".join(buf)
            if ch in ("\x1b", 27):
                return None
            if ch in (curses.KEY_BACKSPACE, "\x7f", "\b", 127, 8):
                buf = buf[:-1]
            elif isinstance(ch, str) and ch.isprintable():
                buf.append(ch)
    finally:
        curses.curs_set(0)


def run_sso_input(stdscr, args, title, stdin_text):
    """Like run_sso, but feeds stdin (the password) so it never appears in argv / `ps`. -> exit code."""
    curses.def_prog_mode()
    curses.endwin()
    print(f"\n\033[1m── {title} ──\033[0m   (ssolab {' '.join(args)})\n", flush=True)
    p = subprocess.Popen([SSO] + args, stdin=subprocess.PIPE, text=True)
    p.communicate(stdin_text + "\n")
    rc = p.returncode
    print(f"\n\033[{'32' if rc == 0 else '31'}m{'done' if rc == 0 else f'failed (exit {rc}) — the form keeps your values'}\033[0m"
          " — press Return to go back", flush=True)
    try:
        input()
    except EOFError:
        pass
    curses.reset_prog_mode()
    stdscr.refresh()
    return rc


def new_user_form(stdscr, data, provider=None):
    """One screen for every option of a new IdP test user; Create runs `ssolab user create` (password via stdin)."""
    mod = cli()
    st, _ = data.get()
    provs = list(mod.PROVIDERS)
    using = lambda p: [s["name"] for s in (st or {}).get("instances", [])
                       if s.get("up") and s["sso"].get("enabled") and s["sso"].get("provider") == p]
    f = dict(provider=provider if provider in provs else "saml", username="", label="", email="", password="",
             role="observer", team="", notes="test user", mfa=False, reveal=False)
    f["fleet"] = set(using(f["provider"]) or list(mod.INSTANCES)[:1])
    touched, sel, msg = set(), 0, ""

    def rows():
        p = f["provider"]
        r = [("provider", "Provider"), ("username", "Username" + (" (email)" if p in ("okta", "authentik", "auth0") else
                                                              " (name → name@tenant domain)" if p == "entra" else "")),
             ("label", "Label"), ("email", "Fleet sign-in email"), ("password", "Password"),
             ("role", "Fleet role"), ("team", "Fleet (team)")]
        r += [(f"fleet:{i}", f"Create in {i} Fleet") for i in mod.INSTANCES]
        if p == "okta":
            r.append(("mfa", "Require Okta Verify"))
        r += [("notes", "Notes"), ("create", "Create user"), ("cancel", "Cancel")]
        return r

    def derive():
        u = f["username"].strip()
        if "label" not in touched:
            f["label"] = u
        if f["provider"] == "entra":     # Entra signs users in by UPN; Fleet must use exactly that
            dom = mod.load_profile("entra").get("domain", "")
            f["email"] = u if "@" in u or not u else (f"{u}@{dom}" if dom else "")
        elif "email" not in touched:
            f["email"] = u if "@" in u else (f"{u}@example.com" if u and f["provider"] == "saml" else "")
        if "role" not in touched:
            f["role"] = mod.default_role(f["label"])

    def value(key):
        p = f["provider"]
        if key == "provider":
            pinfo = next((x for x in (st or {}).get("providers", []) if x["key"] == p), {})
            svc = pinfo.get("service")
            hint = f"  (stopped — run `ssolab {p} up` first)" if svc == "stopped" else \
                   ("  (in use on " + ", ".join(using(p)) + ")") if using(p) else ""
            return f"◀ {mod.PROVIDERS[p]['name']} ▶{hint}"
        if key == "password":
            if not f["password"]:
                return "(empty — g generates one, ⏎ to type)"
            return f["password"] if f["reveal"] else "•" * 12 + "   (v reveal)"
        if key == "role":
            return f"◀ {f['role']} ▶" + ("   (global role)" if not f["team"] else f"   (role in fleet '{f['team']}')")
        if key == "team":
            return f["team"] or "(blank = global role)"
        if key.startswith("fleet:"):
            i = key.split(":")[1]
            return ("[x]" if i in f["fleet"] else "[ ]") + ("   uses this IdP" if i in using(p) else "")
        if key == "mfa":
            return "[x] yes — 2 factors" if f["mfa"] else "[ ] no — password only"
        if key in ("create", "cancel"):
            return ""
        return f[key] or "—"

    while True:
        rs = rows()
        sel = min(sel, len(rs) - 1)
        stdscr.erase()
        h, w = stdscr.getmaxyx()
        put = lambda y, x, t, a=0: stdscr.addnstr(y, x, t, max(0, w - x - 1), a) if 0 <= y < h else None
        put(0, 1, "New user", curses.A_BOLD)
        put(0, 11, "created in the IdP, saved to LOGINS.md + 1Password, and given a Fleet account", curses.A_DIM)
        for j, (key, lab) in enumerate(rs):
            y = 2 + j + (1 if key in ("create", "cancel") else 0)
            a = curses.A_REVERSE if j == sel else 0
            if key in ("create", "cancel"):
                put(y, 3, f"{'›' if j == sel else ' '} [ {lab} ]", a | (curses.A_BOLD if key == "create" else 0))
                continue
            put(y, 3, f"{'›' if j == sel else ' '} {lab:<22}", a)
            put(y, 28, value(key), curses.color_pair(3) if key == "password" and f["reveal"] else 0)
        put(h - 2, 3, msg, curses.color_pair(2) if msg.startswith("!") else curses.color_pair(1))
        put(h - 1, 1, "↑↓ move  ⏎ edit/toggle  ←→ (h/l) change choice  g generate password  v reveal  esc cancel", curses.A_DIM)
        stdscr.refresh()
        k = stdscr.getch()
        if k == -1:
            continue
        key = rs[sel][0]
        msg = ""
        if k in (curses.KEY_UP, ord("k")):
            sel = (sel - 1) % len(rs)
        elif k in (curses.KEY_DOWN, ord("j"), 9):
            sel = (sel + 1) % len(rs)
        elif k == 27:
            return
        elif k == ord("g"):
            f["password"] = subprocess.run([SSO, "genpw"], capture_output=True, text=True).stdout.strip()
            f["reveal"] = True
            msg = "generated a password (shown — v hides it)"
        elif k == ord("v"):
            f["reveal"] = not f["reveal"]
        elif k in (curses.KEY_LEFT, curses.KEY_RIGHT, ord("h"), ord("l")) or (k == ord(" ") and key in ("provider", "role")):
            step = -1 if k in (curses.KEY_LEFT, ord("h")) else 1
            if key == "provider":
                f["provider"] = provs[(provs.index(f["provider"]) + step) % len(provs)]
                if not any(x.startswith("fleet:") for x in touched):
                    f["fleet"] = set(using(f["provider"]) or list(mod.INSTANCES)[:1])
                derive()
            elif key == "role":
                roles = list(mod.GLOBAL_ROLES)
                f["role"] = roles[(roles.index(f["role"]) + step) % len(roles)] if f["role"] in roles else roles[0]
                touched.add("role")
        elif k in (10, 13, curses.KEY_ENTER, ord(" ")):
            if key.startswith("fleet:"):
                i = key.split(":")[1]
                f["fleet"] ^= {i}
                touched.add(key)
            elif key == "mfa":
                f["mfa"] = not f["mfa"]
            elif key == "cancel":
                return
            elif key in ("provider", "role"):
                continue
            elif key == "create":
                p = f["provider"]
                if not f["username"].strip() or not f["email"].strip() or not f["password"]:
                    msg = "! username, Fleet sign-in email and password are required"
                    continue
                args = ["user", "create", "--provider", p, "--username", f["username"].strip(),
                        "--label", f["label"].strip() or f["username"].strip(), "--email", f["email"].strip(),
                        "--role", f["role"], "--fleet", ",".join(sorted(f["fleet"])) or "none",
                        "--notes", f["notes"] or "test user", "--password-stdin"]
                if f["team"].strip():
                    args += ["--team", f["team"].strip()]
                if p == "okta":
                    args.append("--mfa" if f["mfa"] else "--no-mfa")
                if run_sso_input(stdscr, args, f"New {mod.PROVIDERS[p]['name']} user {f['username']}", f["password"]) == 0:
                    data.refresh_now()
                    return
            else:
                y = 2 + sel
                new = edit_line(stdscr, y, 28, f[key], max(10, w - 30), mask=(key == "password" and not f["reveal"]))
                if new is not None:
                    f[key] = new
                    touched.add(key)
                    if key == "username":
                        derive()
                    if key == "label" and "role" not in touched:
                        f["role"] = mod.default_role(new)


def clipboard(text, clear_after=CLIPBOARD_SECS):
    """Copy with pbcopy; clear it again after a while unless something else was copied meanwhile."""
    subprocess.run(["pbcopy"], input=text, text=True)

    def clear():
        time.sleep(clear_after)
        cur = subprocess.run(["pbpaste"], capture_output=True, text=True).stdout
        if cur == text:
            subprocess.run(["pbcopy"], input="", text=True)
    threading.Thread(target=clear, daemon=True).start()


def logins_view(stdscr, data, provider=None):
    """Arrow through saved logins; ⏎ reveals the selected password (auto-hides), c/u copy password/username."""
    mod = cli()
    sel, shown, shown_at, msg = 0, None, 0.0, ""
    fleet = {}   # inst -> {email: user} (or None on error), filled in the background

    def load_fleet():
        for inst in mod.INSTANCES:
            try:
                fleet[inst] = mod.fleet_users(inst)
            except Exception:
                fleet[inst] = None
    threading.Thread(target=load_fleet, daemon=True).start()

    def fleet_cell(r):
        if not r.get("email"):
            return "–", 0
        parts, missing = [], False
        for inst in mod.INSTANCES:
            have = fleet.get(inst)
            mark = "…" if inst not in fleet else "?" if have is None else "✓" if r["email"].lower() in have else "–"
            missing = missing or mark == "–"
            parts.append(f"{inst}{mark}")
        return " ".join(parts), (3 if missing else 1)

    while True:
        rows = [r for r in mod.read_logins() if not provider or r["provider"] == provider]
        sel = max(0, min(sel, len(rows) - 1))
        if shown is not None and (time.time() - shown_at > REVEAL_SECS or shown != sel):
            shown = None
        stdscr.erase()
        h, w = stdscr.getmaxyx()
        put = lambda y, x, t, a=0: stdscr.addnstr(y, x, t, max(0, w - x - 1), a) if 0 <= y < h else None
        title = f"Logins — {mod.PROVIDERS[provider]['name']}" if provider else "Logins — all providers"
        put(0, 1, title, curses.A_BOLD)
        put(0, 3 + len(title), f"{len(rows)} saved in LOGINS.md · vault \"{mod.VAULT}\"", curses.A_DIM)
        put(2, 1, f"  {'PROVIDER':<11}{'LABEL':<26}{'USERNAME':<34}{'PASSWORD':<28}{'IN FLEET':<16}{'1PASSWORD':<19}NOTES",
            curses.A_UNDERLINE)
        if not rows:
            put(4, 3, "No logins yet — press a to add one." if provider else "No logins yet.", curses.A_DIM)
        top = max(0, sel - (h - 7))
        for i, r in enumerate(rows[top:top + h - 6]):
            i += top
            pw = r["password"] if shown == i else "•" * 10
            onep = r["1password"] or "pending"
            fc, fcol = fleet_cell(r)
            line = (f"{'›' if i == sel else ' '} {r['provider']:<11}{r['label'][:25]:<26}{r['username'][:33]:<34}"
                    f"{pw[:27]:<28}{fc:<16}{onep[:18]:<19}{r['notes']}")
            put(3 + i - top, 1, line.ljust(w - 3), curses.A_REVERSE if i == sel else 0)
            if i != sel:
                put(3 + i - top, 74, pw[:27], curses.color_pair(3) if shown == i else curses.A_DIM)
                put(3 + i - top, 102, fc, curses.color_pair(fcol) if fcol else curses.A_DIM)
                put(3 + i - top, 118, onep[:18], curses.color_pair(1 if onep.startswith("synced") else 3))
        if shown is not None:
            msg = f"password shown — hides in {max(0, int(REVEAL_SECS - (time.time() - shown_at)))}s"
        if rows:
            put(h - 3, 3, f"URL: {rows[sel]['url']}", curses.A_DIM)
        put(h - 2, 3, msg, curses.color_pair(1))
        put(h - 1, 1, "↑↓ move  ⏎/space reveal·hide  c copy pw  u copy user  f create in Fleet  F all missing  a new user  "
                      "s 1Password sync  ← back", curses.A_DIM)
        stdscr.refresh()
        k = stdscr.getch()
        if k == -1:      # 1 s tick: refresh the countdown
            if shown is None and msg.startswith("password shown"):
                msg = ""
            continue
        msg = ""
        if k in (curses.KEY_UP, ord("k")) and rows:
            sel = (sel - 1) % len(rows)
        elif k in (curses.KEY_DOWN, ord("j")) and rows:
            sel = (sel + 1) % len(rows)
        elif k in (10, 13, curses.KEY_ENTER, ord(" ")) and rows:
            shown, shown_at = (None, 0.0) if shown == sel else (sel, time.time())
        elif k in (ord("f"), ord("F")) and rows:
            r = rows[sel]
            if k == ord("f") and not r.get("email"):
                msg = f"{r['provider']}/{r['label']} has no email, so it isn't a Fleet SSO user (tenant/admin login)"
                continue
            args = ["users", "sync", r["provider"]] + (["--label", r["label"]] if k == ord("f") else [])
            run_sso(stdscr, args, f"Create {r['label'] if k == ord('f') else 'missing ' + r['provider'] + ' users'} in Fleet")
            fleet.clear()
            threading.Thread(target=load_fleet, daemon=True).start()
        elif k == ord("c") and rows:
            clipboard(rows[sel]["password"])
            msg = f"password for {rows[sel]['provider']}/{rows[sel]['label']} copied — clipboard clears in {CLIPBOARD_SECS}s"
        elif k == ord("u") and rows:
            clipboard(rows[sel]["username"], clear_after=CLIPBOARD_SECS)
            msg = f"username {rows[sel]['username']} copied"
        elif k == ord("a"):
            new_user_form(stdscr, data, provider or (rows[sel]["provider"] if rows else None))
            fleet.clear()
            threading.Thread(target=load_fleet, daemon=True).start()
        elif k == ord("s"):
            run_sso(stdscr, ["creds", "sync"], "1Password sync")
        elif k in (curses.KEY_LEFT, 27, ord("b"), ord("q")):
            return


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
            items = [("inst", s) for s in st["instances"]] + [("sep", None)] + [("prov", p) for p in st["providers"]]
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
        if k in (curses.KEY_UP, ord("k")):
            sel = selectable[(pos - 1) % len(selectable)]
        elif k in (curses.KEY_DOWN, ord("j")):
            sel = selectable[(pos + 1) % len(selectable)]
        elif k in (10, 13, curses.KEY_ENTER, curses.KEY_RIGHT):
            kind, obj = items[sel]
            if kind == "inst":
                switch_flow(stdscr, data, obj)
            else:
                provider_flow(stdscr, data, obj)
        elif k == ord("w") and items[sel][0] == "inst":
            run_sso(stdscr, ["why", items[sel][1]["name"], "8"], f"Recent SSO sign-ins on {items[sel][1]['name']}")
        elif k == ord("t") and items[sel][0] == "inst":
            run_sso(stdscr, ["test", items[sel][1]["name"]], f"Testing {items[sel][1]['name']}")
        elif k == ord("s"):
            run_sso(stdscr, ["creds", "sync"], "1Password sync")
        elif k == ord("l"):
            logins_view(stdscr, data)
        elif k == ord("n"):
            new_user_form(stdscr, data, items[sel][1]["key"] if items[sel][0] == "prov" else None)
        elif k == ord("g"):
            run_sso(stdscr, ["gitops", "show"], "GitOps block in default.yml")
        elif k == ord("r"):
            data.refresh_now()
        elif k == ord("q"):
            return


if __name__ == "__main__":
    os.environ.setdefault("ESCDELAY", "25")
    curses.wrapper(main)
