# premium-fleetqa

GitOps config for the Premium QA Fleet instance. `default.yml` mirrors `free-fleetqa/` and configures the **No team** (team_id=0) scope; `fleets/workstations.yml` configures the **Workstations** team.

```
premium-fleetqa/
├── default.yml              # org settings + No-team (team_id=0) controls/policies/etc.
└── fleets/
    └── workstations.yml     # team "Workstations" — full scope
```

All `path:` references resolve to `../lib/` (or `../../lib/` from `fleets/`) — same source of truth as the free configs.

## Apply

```bash
set -a; source playwright/.env.premium; set +a
fleetctl gitops \
  -f gitops/premium-fleetqa/default.yml \
  -f gitops/premium-fleetqa/fleets/workstations.yml \
  --delete-other-fleets
```

`--delete-other-fleets` makes gitops the source of truth for which teams exist on the instance — any team not listed here gets deleted on apply. Default is **off** (so it's opt-in).

## Scope summary

| Scope | Profiles | Policies | Scripts |
|---|---:|---:|---:|
| No team (default.yml) | 23 | 27 | 11 |
| Workstations (fleets/workstations.yml) | 23 | 23 | 6 |
