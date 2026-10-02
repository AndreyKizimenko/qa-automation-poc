# loadtest-api-audit

Checks that every request in the Playwright `loadtest-api` matrix
(`playwright/tests/loadtest/api/shapes.ts`) is a legitimate Fleet request:
the path is a GET route Fleet registers for `/api/latest`, and every query
parameter is one the route's request struct actually decodes. Fleet ignores
unknown query parameters, so a typo would silently time the wrong request —
this is the check that catches it.

```bash
python3 tools/loadtest-api-audit/audit-shapes.py
# or, with the Fleet checkout somewhere else:
FLEET_REPO=/path/to/fleet python3 tools/loadtest-api-audit/audit-shapes.py
```

Needs a Fleet checkout on the branch you are testing (the routes and request
structs are read from its source) and Node ≥ 22.6 to evaluate `shapes.ts`.
Exits non-zero on any problem. Run it after adding or editing a shape.
