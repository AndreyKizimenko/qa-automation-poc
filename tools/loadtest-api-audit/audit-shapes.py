#!/usr/bin/env python3
"""Audit the loadtest-api request matrix against the Fleet server source.

Every shape in playwright/tests/loadtest/api/shapes.ts is expanded the way
helpers/perf-api.ts expands it (fleet / global scope, hosts/count twins,
placeholders filled with dummy values) and then checked two ways:

  1. its path must match a GET route registered for /api/latest in the Fleet
     checkout (handler.go and the per-module handlers; routes gated with
     EndingAtVersion("v1") are not served on /latest and do not count);
  2. every query parameter it sends must be one the route's request struct
     decodes: a `query:"..."` tag (plus its `renameto`), one of the option
     structs the struct embeds (ListOptions, HostListOptions, …, resolved
     through the transport helpers that parse them), or a name the route's own
     package reads straight from the query string.

A parameter the server never decodes is silently ignored and the shape would
time the wrong request — which is the failure this script exists to catch.

Usage:
    python3 tools/loadtest-api-audit/audit-shapes.py            # FLEET_REPO=~/repositories/fleet
    FLEET_REPO=/path/to/fleet python3 tools/loadtest-api-audit/audit-shapes.py

Needs Node ≥ 22.6 (type stripping) to read shapes.ts. Exits 1 when any shape
fails either check, so it can gate a PR that touches the matrix.
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
from collections import defaultdict

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
SHAPES_TS = REPO / 'playwright' / 'tests' / 'loadtest' / 'api' / 'shapes.ts'
FLEET = pathlib.Path(os.environ.get('FLEET_REPO', pathlib.Path.home() / 'repositories' / 'fleet')).expanduser()

# Placeholder values only need to satisfy the route patterns.
DUMMY = {
    'FLEET': '1', 'CVE_TOP': 'CVE-2020-1171', 'CVE_RARE': 'CVE-2020-1171', 'PROFILE_UUID': 'a1b2c3',
    'BATCH_ID': 'abc-123', 'HOST_NAME': 'host', 'HOST_PREFIX': 'hos', 'HOST_SERIAL': 'SER1', 'HOST_UUID': 'UUID1',
    'HOST_ISSUES_UUID': 'UUID2', 'HOST_ISSUES_SERIAL': 'SER2', 'HOST_WIN_UUID': 'UUID3', 'HOST_WIN_SERIAL': 'SER3',
    'HOST_EMAIL': 'a@b.c', 'HOST_EMAIL_LOCAL': 'a', 'OS_NAME': 'macOS', 'OS_VERSION': '14.1',
}


def load_shapes():
    if not SHAPES_TS.exists():
        sys.exit(f'shapes file not found: {SHAPES_TS}')
    with tempfile.TemporaryDirectory() as tmp:
        wrapper = pathlib.Path(tmp) / 'dump.mts'
        wrapper.write_text(f"import {{ SHAPES }} from '{SHAPES_TS}';\nconsole.log(JSON.stringify(SHAPES));\n")
        run = subprocess.run(['node', '--experimental-strip-types', str(wrapper)], capture_output=True, text=True)
    if run.returncode != 0:
        sys.exit(f'could not evaluate shapes.ts with node --experimental-strip-types:\n{run.stderr}')
    return json.loads(run.stdout)


def load_go():
    if not FLEET.exists():
        sys.exit(f'Fleet checkout not found at {FLEET} (set FLEET_REPO)')
    files = [f for d in ('server', 'ee') for f in (FLEET / d).rglob('*.go') if not f.name.endswith('_test.go')]
    return {f: f.read_text(errors='ignore') for f in files}


ROUTE_RE = re.compile(r'GET\(\s*"(/api/[^"]+)"\s*,\s*(\w+)\s*,\s*([^)]*?)\s*\)')
ALT_RE = re.compile(r'WithAltPaths\(((?:\s*"[^"]+"\s*,?)+)\)')
STRUCT_RE = re.compile(r'^type (\w+) struct \{\n(.*?)^\}', re.M | re.S)
QUERY_READ_RE = re.compile(r'(?:q|r\.URL\.Query\(\)|Query\(\))\.(?:Get|Has)\("([^"]+)"\)')


def index_routes(src):
    routes = []  # (pattern, path, request struct or None, defining file)
    for f, s in src.items():
        for line in s.splitlines():
            if 'GET(' not in line or '/api/' not in line or 'EndingAtVersion(' in line:
                continue
            m = ROUTE_RE.search(line)
            if not m:
                continue
            path, _endpoint, req = m.groups()
            req = None if req.strip() == 'nil' else req.strip().rstrip('{}').split('.')[-1]
            paths = [path]
            am = ALT_RE.search(line)
            if am:
                paths += re.findall(r'"([^"]+)"', am.group(1))
            for p in paths:
                pat = p.replace('_version_', 'latest')
                pat = re.sub(r'\{[a-zA-Z_]+:([^}]+)\}', lambda mm: '(' + mm.group(1) + ')', pat)
                pat = re.sub(r'\{[a-zA-Z_]+\}', '([^/]+)', pat)
                routes.append((re.compile('^' + pat + '$'), p, req, f))
    return routes


def index_structs(src):
    structs = defaultdict(list)
    for s in src.values():
        for m in STRUCT_RE.finditer(s):
            structs[m.group(1)].append(m.group(2))
    return structs


def names_read_in_func(src, fn_name, seen=None):
    """Query names a transport helper reads, following the helpers it calls."""
    seen = seen or set()
    if fn_name in seen:
        return set()
    seen.add(fn_name)
    out = set()
    for s in src.values():
        m = re.search(r'func ' + fn_name + r'\(.*?\n\}', s, re.S)
        if not m:
            continue
        body = m.group(0)
        out |= set(QUERY_READ_RE.findall(body))
        out |= set(re.findall(r'Query\(\)\["([^"]+)"\]', body))
        for a, b in re.findall(r'handleDeprecatedParams\(r, "([^"]+)", "([^"]+)"\)', body):
            out |= {a, b}
        for call in re.findall(r'(\w+OptionsFromRequest)\(r\)', body):
            out |= names_read_in_func(src, call, seen)
    return out


def main():
    shapes = load_shapes()
    src = load_go()
    routes = index_routes(src)
    structs = index_structs(src)

    list_names = names_read_in_func(src, 'listOptionsFromRequest') | {'page', 'per_page', 'order_key', 'order_direction', 'after', 'query'}
    special = {
        'ListOptions': list_names,
        'HostListOptions': names_read_in_func(src, 'hostListOptionsFromRequest') | list_names,
        'UserListOptions': names_read_in_func(src, 'userListOptionsFromRequest') | list_names,
        'CarveListOptions': names_read_in_func(src, 'carveListOptionsFromRequest') | list_names,
    }

    def params_of(struct_name, seen=None):
        seen = seen or set()
        if struct_name in seen:
            return set()
        seen.add(struct_name)
        out = set(special.get(struct_name, ()))
        for body in structs.get(struct_name, []):
            for raw in body.splitlines():
                line = raw.split('//')[0].strip()
                if not line:
                    continue
                out.update(re.findall(r'query:"([^",]+)', line))
                out.update(re.findall(r'renameto:"([^",]+)', line))
                tokens = line.split('`')[0].split()
                if not tokens:
                    continue
                typ = tokens[1] if len(tokens) > 1 else tokens[0]
                base = typ.lstrip('*[]').split('.')[-1]
                if base in special or base.endswith('Options') or base.endswith('Request'):
                    out |= params_of(base, seen)
        return out

    # Names a module reads straight from the query string (the activity
    # module decodes activity_type / start_created_at this way).
    module_reads = defaultdict(set)
    for f, s in src.items():
        module_reads[f.parent] |= set(QUERY_READ_RE.findall(s))

    def sub(text):
        return re.sub(r'\{([A-Z][A-Z0-9_]*)\}', lambda m: DUMMY.get(m.group(1), '7'), text)

    problems, checked = [], 0
    for sh in shapes:
        scope = sh.get('scope') or 'both'
        scopes = ['fleet', 'global'] if scope == 'both' else [scope]
        variants = [(sh['path'], dict(sh.get('params') or {}), sh['id'])]
        if sh.get('countTwin'):
            twin = dict(sh.get('params') or {})
            for k in ('page', 'per_page', 'order_key', 'order_direction'):
                twin.pop(k, None)
            variants.append(('hosts/count', twin, sh['id'] + '.count'))
        for path, params, sid in variants:
            for sc in scopes:
                p = dict(params)
                if sc == 'fleet' and 'fleet_id' not in p and '{FLEET}' not in path:
                    p['fleet_id'] = '{FLEET}'
                url = '/api/latest/fleet/' + sub(path)
                matched = [r for r in routes if r[0].match(url)]
                checked += 1
                if not matched:
                    problems.append((sid, sc, url, 'no GET route registered for /api/latest'))
                    continue
                allowed = set()
                for _, _, req, rfile in matched:
                    if req:
                        allowed |= params_of(req)
                    allowed |= module_reads[rfile.parent]
                if 'team_id' in allowed:
                    allowed.add('fleet_id')
                bad = [k for k in p if k not in allowed]
                if bad:
                    problems.append((sid, sc, url, f'parameters the route never decodes ({[r[2] for r in matched]}): {bad}'))

    print(f'fleet checkout: {FLEET}')
    print(f'routes indexed: {len(routes)}  request structs: {len(structs)}  shape variants checked: {checked}')
    if not problems:
        print('OK — every shape routes to a registered GET endpoint and sends only parameters it decodes.')
        return 0
    print(f'\n{len(problems)} problem(s):')
    for sid, sc, url, why in problems:
        print(f'  {sid}@{sc}  {url}\n      {why}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
