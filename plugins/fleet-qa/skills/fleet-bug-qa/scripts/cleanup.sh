#!/bin/bash
# usage: cleanup.sh <manifest>          list what would be undone (reads nothing else)
#        cleanup.sh <manifest> --run    undo it, newest first
# Manifest lines, appended at creation time:
#   api <ctx> <METHOD> <path> [json-body]    e.g. api default DELETE /api/v1/fleet/teams/12
#                                                 api default POST /api/v1/fleet/global/policies/delete {"ids":[5]}
#   pid <pid> [# note]                       a background process this run started (osquery-perf, a proxy)
#   worktree <path>                          git worktree to remove
#   docker <container-or-network>            docker container / network to remove
#   file <path>                              a file/dir created outside the qa folder
# A trailing " # note" is allowed on any line; lines starting with # are notes. Hosts outlive their
# fleet (they move to "No fleet"), so record a host delete for every host you enroll.
cfg() { awk -v c="  $1:" -v k="$2:" '$0==c{f=1;next} f&&/^  [a-z]/{exit} f&&$1==k{print $2}' ~/.fleet/config; }
M="$1"; [ -f "$M" ] || { echo "no manifest $M"; exit 2; }
{ tail -r "$M" 2>/dev/null || tac "$M"; } | while IFS= read -r line; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  if [ "$2" != "--run" ]; then echo "would: $line"; continue; fi
  item=${line%% # *}; kind=${item%% *}; args=${item#* }
  case "$kind" in
    api) read -r ctx method path body <<<"$args"
         if [ -n "$body" ]; then
           code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" -H "Authorization: Bearer $(cfg "$ctx" token)" -H "Content-Type: application/json" -d "$body" "$(cfg "$ctx" address)$path")
         else
           code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" -H "Authorization: Bearer $(cfg "$ctx" token)" "$(cfg "$ctx" address)$path")
         fi
         echo "$code $line" ;;
    pid) kill "${args%% *}" 2>/dev/null && echo "killed $line" || echo "gone $line" ;;
    worktree) git -C "${FLEET_REPO:-$HOME/repositories/fleet}" worktree remove --force "$args" && echo "removed $line" ;;
    docker) { docker rm -f "$args" || docker network rm "$args"; } >/dev/null 2>&1 && echo "removed $line" || echo "gone $line" ;;
    file) rm -rf -- "$args" && echo "removed $line" ;;
    *) echo "unknown: $line" ;;
  esac
done
