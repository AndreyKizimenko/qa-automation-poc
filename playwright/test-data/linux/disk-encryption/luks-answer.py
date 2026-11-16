# Answers fleetd's LUKS passphrase dialog through the desktop's accessibility API, as the desktop user.
# The passphrase arrives on stdin and is never printed. Usage: luks-answer.py <answer|cancel|wrong-then-answer> <seconds>
# Logs only what it saw and did, so its log can be read back through Fleet.
import sys
import time

import pyatspi

TITLE = "Enter disk encryption passphrase"
NOTICE = "Disk encryption"
MODE = sys.argv[1]
DEADLINE = time.time() + float(sys.argv[2])
SECRET = sys.stdin.read()


def log(message):
    print(time.strftime("%H:%M:%S"), message, flush=True)


def find_window(title):
    for app in pyatspi.Registry.getDesktop(0):
        if app is None:
            continue
        for window in app:
            if window is not None and window.name == title:
                return window
    return None


def walk(node):
    yield node
    for child in node:
        if child is not None:
            yield from walk(child)


def wait_for_window(title, deadline):
    while time.time() < deadline:
        try:
            window = find_window(title)
        except Exception as e:  # the tree changes under us while windows open and close
            log("accessibility tree read failed: %r" % (e,))
            window = None
        if window is not None:
            return window
        time.sleep(0.5)
    return None


def answer(window, text):
    entry = ok = cancel = None
    for node in walk(window):
        role = node.getRole()
        if entry is None and role in (pyatspi.ROLE_PASSWORD_TEXT, pyatspi.ROLE_ENTRY, pyatspi.ROLE_TEXT):
            entry = node
        if role == pyatspi.ROLE_PUSH_BUTTON and node.name in ("OK", "_OK"):
            ok = node
        if role == pyatspi.ROLE_PUSH_BUTTON and node.name in ("Cancel", "_Cancel"):
            cancel = node
    log("entry %s, OK %s, Cancel %s" % (
        entry.getRoleName() if entry else "missing", "found" if ok else "missing", "found" if cancel else "missing"))
    if text is None:
        if cancel is None:
            sys.exit(3)
        cancel.queryAction().doAction(0)
        log("pressed Cancel")
        return
    if entry is None or ok is None:
        sys.exit(3)
    entry.queryEditableText().setTextContents(text)
    time.sleep(0.5)
    ok.queryAction().doAction(0)
    log("pressed OK")


log("waiting for the dialog, mode %s" % MODE)
dialog = wait_for_window(TITLE, DEADLINE)
if dialog is None:
    log("the dialog never appeared")
    sys.exit(2)
log("dialog found")
if MODE == "cancel":
    answer(dialog, None)
elif MODE == "wrong-then-answer":
    answer(dialog, "not-the-passphrase")
    time.sleep(3)
    dialog = wait_for_window(TITLE, DEADLINE)
    if dialog is None:
        log("no second dialog after the wrong passphrase")
        sys.exit(4)
    log("second dialog found")
    answer(dialog, SECRET)
else:
    answer(dialog, SECRET)


def close_notice(seconds):
    """fleetd's notice after an escrow holds its queue until it closes. Its first words say how it went."""
    notice = wait_for_window(NOTICE, time.time() + seconds)
    if notice is None:
        log("no notice within %ss" % seconds)
        return
    texts = [n.name for n in walk(notice) if n.getRole() == pyatspi.ROLE_LABEL and n.name]
    log("notice: %s" % " | ".join(t[:48] for t in texts))
    for node in walk(notice):
        if node.getRole() == pyatspi.ROLE_PUSH_BUTTON and node.name in ("OK", "_OK"):
            node.queryAction().doAction(0)
            log("closed the notice")
            return


if MODE != "cancel":
    close_notice(240)
log("done")
