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
