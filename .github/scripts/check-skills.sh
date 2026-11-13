#!/usr/bin/env bash
# Lints the Claude Code skills in this repo: the `fleet-qa` plugin under plugins/ and
# the repo skills under .claude/skills/. Run from the repo root; exits 1 on the first
# category of problem it finds, after printing every instance of it.
#
# What it checks, and why each one is here:
# - SKILL.md frontmatter: opens with `---`, has `name:` equal to the folder name and a
#   non-empty `description:`. The name is what `/<name>` invokes and what the plugin
#   namespaces (`fleet-qa:<name>`), so a name with a colon or one that differs from
#   the folder breaks invocation quietly.
# - What Claude will actually be shown (the "descriptions, bodies and paths" step):
#   - The description survives YAML. An unquoted value is cut at the first " #" (the
#     rest reads as a comment), so a trigger example like "QA #51234" silently drops
#     every phrase after it and the whole "Not for…" clause; ": " breaks the parse.
#     Quote the value. It also stays under 1,024 characters: the listing is a shared
#     budget, and the least-used skills lose their descriptions first when it overflows.
#   - The body fits what survives a long session. After auto-compaction Claude Code
#     re-attaches only about the first 19,800 characters of a skill (measured in real
#     sessions), and it almost never re-reads the file. A body that renders past 19,000
#     gets a warning: move step detail into references/ and keep the rules on top.
#   - ${CLAUDE_PLUGIN_ROOT} and ${CLAUDE_SKILL_DIR} are substituted only in SKILL.md.
#     Every path built on them must exist, and a reference or script must not use
#     them: there they stay literal, and they aren't in the Bash tool's environment.
#   - A block between `<!-- shared:NAME -->` and `<!-- /shared:NAME -->` is a rule
#     several skills carry inline on purpose (it has to survive compaction in each).
#     Every copy must be identical, so a rule is never fixed in one skill only.
# - No orphan bundled files: every file under a skill's references/ and scripts/ is
#   named somewhere in that skill's SKILL.md or references, or nobody will ever load it.
# - Plugin manifests: each plugins/*/.claude-plugin/plugin.json parses and carries
#   name, version and description; .claude-plugin/marketplace.json parses, and each
#   entry's `source` points at a plugin whose plugin.json has the same name.
# - No instance hostnames or credential-shaped strings in skill text, plugin
#   manifests or docs. The repo is public; instances and tokens live in
#   ~/.claude/fleet-qa.local.md, ~/.fleet/config and gitignored .env files.
set -uo pipefail

fail=0
problem() { echo "::error::$*"; fail=1; }

skill_files=$(git ls-files 'plugins/*/skills/*/SKILL.md' '.claude/skills/*/SKILL.md')
if [ -z "$skill_files" ]; then problem "no SKILL.md files found"; exit 1; fi

echo "== frontmatter"
for f in $skill_files; do
  dir=$(basename "$(dirname "$f")")
  [ "$(sed -n '1p' "$f")" = "---" ] || problem "$f: line 1 is not '---'"
  close=$(awk 'NR>1 && /^---$/ {print NR; exit}' "$f")
  [ -n "$close" ] || { problem "$f: frontmatter never closes"; continue; }
  fm=$(sed -n "2,$((close-1))p" "$f")
  name=$(printf '%s\n' "$fm" | sed -n 's/^name:[[:space:]]*//p' | head -1)
  desc=$(printf '%s\n' "$fm" | sed -n 's/^description:[[:space:]]*//p' | head -1)
  [ -n "$name" ] || problem "$f: no name: in frontmatter"
  [ "$name" = "$dir" ] || problem "$f: name '$name' differs from folder '$dir'"
  case "$name" in *:*) problem "$f: name '$name' contains ':' (the plugin prefix is applied automatically)";; esac
  [ -n "$desc" ] || problem "$f: no description: in frontmatter, or it is empty"
done
[ "$fail" = 0 ] || exit 1

echo "== descriptions, bodies and paths"
# shellcheck disable=SC2086
python3 -I - $skill_files <<'PY' || fail=1
import pathlib, re, subprocess, sys
try:
    import yaml
except ImportError:      # the hazard rules below still run without it
    yaml = None

MAX_DESC = 1024          # the open skill spec's limit; Claude Code truncates at 1,536
BODY_WARN = 19000        # Claude Code keeps about the first 19,800 characters after compaction
ROOT = "/home/someone/.claude/plugins/cache/marketplace/plugin/0.0.0"   # a typical install path's length
bad = 0
def err(m):
    global bad; bad = 1; print(f"::error::{m}")
def warn(m):
    print(f"::warning::{m}")

shared = {}
for f in sys.argv[1:]:
    p = pathlib.Path(f)
    fm, body = p.read_text().split("---\n", 2)[1:]
    raw = re.search(r"^description:[ \t]*(.*)$", fm, re.M).group(1)
    if raw[:1] not in ("\"", "'", ">", "|"):
        cut = re.search(r"\s#", raw)
        if cut:
            err(f"{f}: the description is unquoted and contains ' #'. YAML reads the rest as a comment, so Claude sees it end at "
                f"{raw[:cut.start()][-30:]!r}. Put the value in double quotes.")
        if ": " in raw:
            err(f"{f}: the description is unquoted and contains ': ', which breaks the YAML. Put the value in double quotes.")
    desc = raw.strip("\"'")
    if yaml:
        try:
            desc = yaml.safe_load(fm).get("description")
        except Exception as e:
            err(f"{f}: frontmatter is not valid YAML ({str(e).splitlines()[0]}); Claude Code loads the skill with no description")
    if isinstance(desc, str) and len(desc) > MAX_DESC:
        err(f"{f}: the description is {len(desc)} characters (limit {MAX_DESC}). Keep what it does, when to use it and what it "
            f"isn't for; the rest belongs in the body.")

    plugin = re.match(r"(plugins/[^/]+)/skills/([^/]+)/", f)
    skill_dir = f"{ROOT}/skills/{plugin.group(2)}" if plugin else f"/home/someone/repo/{p.parent}"
    rendered = body.replace("${CLAUDE_PLUGIN_ROOT}", ROOT).replace("${CLAUDE_SKILL_DIR}", skill_dir)
    if len(rendered) > BODY_WARN:
        warn(f"{f}: the body renders to {len(rendered):,} characters. After auto-compaction only about the first 19,800 are "
             f"kept, so the end of this skill is lost in long sessions. Move step detail into references/, rules on top.")

    for m in re.finditer(r"\$\{CLAUDE_(PLUGIN_ROOT|SKILL_DIR)\}([\w./-]*)", body):
        if m.group(1) == "PLUGIN_ROOT" and not plugin:
            err(f"{f}: ${{CLAUDE_PLUGIN_ROOT}} is substituted only in plugin skills"); continue
        base = pathlib.Path(plugin.group(1)) if m.group(1) == "PLUGIN_ROOT" else p.parent
        rel = m.group(2).rstrip(".").lstrip("/")
        if not (base / rel).exists():
            err(f"{f}: {m.group(0).rstrip('.')} points at {base / rel}, which doesn't exist")

    for m in re.finditer(r"<!-- shared:([a-z-]+) -->\n(.*?)<!-- /shared:\1 -->", body, re.S):
        shared.setdefault(m.group(1), {})[f] = m.group(2)
    if body.count("<!-- shared:") != body.count("<!-- /shared:"):
        err(f"{f}: a <!-- shared:… --> block is not closed with the matching <!-- /shared:… -->")

    sdir = str(p.parent)
    for other in subprocess.run(["git", "ls-files", f"{sdir}/references", f"{sdir}/scripts"],
                                capture_output=True, text=True).stdout.split():
        try:
            text = pathlib.Path(other).read_text()
        except (UnicodeDecodeError, OSError):
            continue
        if "${CLAUDE_PLUGIN_ROOT}" in text or "${CLAUDE_SKILL_DIR}" in text:
            err(f"{other}: uses ${{CLAUDE_…}}, which is substituted only in SKILL.md. Name the file and say whose it is; "
                f"the SKILL.md gives the path.")

for name, copies in sorted(shared.items()):
    first_file, first = next(iter(copies.items()))
    for f, text in copies.items():
        if text != first:
            err(f"shared block '{name}' in {f} differs from the copy in {first_file}; every copy must be identical")
print(f"   yaml parser: {'PyYAML' if yaml else 'not installed (hazard rules only)'}; "
      f"shared blocks: {', '.join(f'{n} x{len(c)}' for n, c in sorted(shared.items())) or 'none'}")
sys.exit(bad)
PY
[ "$fail" = 0 ] || exit 1

echo "== orphan references and scripts"
for f in $skill_files; do
  sdir=$(dirname "$f")
  for bundled in $(git ls-files "$sdir/references" "$sdir/scripts"); do
    base=$(basename "$bundled")
    case "$base" in README.md|main.go) continue;; esac   # folder-level docs and a script's own module
    if ! grep -rqF "$base" "$f" $(git ls-files "$sdir/references/*.md" 2>/dev/null); then
      problem "$bundled: not mentioned in $f or its references (orphan)"
    fi
  done
done
[ "$fail" = 0 ] || exit 1

echo "== plugin manifests"
python3 -I - <<'PY' || fail=1
import json, pathlib, sys
bad = 0
def err(m):
    global bad; bad = 1; print(f"::error::{m}")
plugins = {}
for p in sorted(pathlib.Path("plugins").glob("*/.claude-plugin/plugin.json")):
    try:
        d = json.loads(p.read_text())
    except Exception as e:
        err(f"{p}: invalid JSON: {e}"); continue
    for k in ("name", "version", "description"):
        if not d.get(k): err(f"{p}: missing {k}")
    plugins[str(p.parent.parent)] = d.get("name")
m = pathlib.Path(".claude-plugin/marketplace.json")
try:
    mk = json.loads(m.read_text())
except Exception as e:
    err(f"{m}: invalid JSON: {e}"); sys.exit(1)
if not mk.get("name"): err(f"{m}: missing name")
if not (mk.get("owner") or {}).get("name"): err(f"{m}: missing owner.name")
entries = mk.get("plugins") or []
if not entries: err(f"{m}: plugins[] is empty")
for e in entries:
    src = (e.get("source") or "").removeprefix("./")
    if src not in plugins:
        err(f"{m}: entry '{e.get('name')}' source '{e.get('source')}' has no plugin.json"); continue
    if plugins[src] != e.get("name"):
        err(f"{m}: entry name '{e.get('name')}' differs from {src}/.claude-plugin/plugin.json name '{plugins[src]}'")
    if not e.get("description"): err(f"{m}: entry '{e.get('name')}' has no description")
sys.exit(bad)
PY
[ "$fail" = 0 ] || exit 1

echo "== instance hostnames and credential-shaped strings"
pattern='ngrok\.app|onrender\.com|sslip\.io|eyJ[A-Za-z0-9_-]{20,}|Bearer [A-Za-z0-9]{20,}|enroll_secret[= ]+[A-Za-z0-9]{12,}|FLEET_API_TOKEN=[A-Za-z0-9]{8,}'
hits=$(git ls-files plugins .claude/skills .claude-plugin README.md playwright/docs playwright/README.md tools \
       | grep -vE '\.(png|jpg|pdf|zip)$' | xargs grep -nE "$pattern" 2>/dev/null || true)
if [ -n "$hits" ]; then
  printf '%s\n' "$hits"
  problem "instance hostname or credential-shaped string above; move it to the local config"
fi
[ "$fail" = 0 ] || exit 1

echo "ok: $(printf '%s\n' "$skill_files" | wc -l | tr -d ' ') skills, manifests consistent, no secrets"
