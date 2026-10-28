#!/usr/bin/env -S python3 -I
"""loglab receiver — local HTTP sink for Fleet's `webhook` and `splunk` log plugins. Started by `loglab up receiver`.

  POST /webhook/<inst>/<result|status|audit>          Fleet webhook writer: {"timestamp": …, "details": [log, …]}
  POST /splunk/<inst>/services/collector/event        Splunk HEC: concatenated {"event": log, …} objects,
                                                      header "Authorization: Splunk <token>" (state/hec.token)
  GET  /splunk/<inst>/services/collector/health       HEC health check
  GET  /healthz

Every log is appended as one JSON line to <sinks>/<inst>/webhook-<type>.jsonl or <sinks>/<inst>/splunk.jsonl
(rotated to .1 at 50 MB). Listens on 127.0.0.1 only.

  loglab-receiver.py <port> <sinks dir> <hec token file> <instance,instance,...>
"""
import json
import os
import re
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SINKS = sys.argv[2] if len(sys.argv) > 2 else "sinks"
TOKEN_FILE = sys.argv[3] if len(sys.argv) > 3 else os.path.join("state", "hec.token")
INSTANCES = tuple(sys.argv[4].split(",")) if len(sys.argv) > 4 else ()
TYPES = ("result", "status", "audit")
MAX_BYTES = 50 * 2**20
lock = threading.Lock()


def append(inst, name, logs):
    d = os.path.join(SINKS, inst)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, name)
    with lock:
        try:
            if os.path.getsize(path) > MAX_BYTES:
                os.replace(path, path + ".1")
        except OSError:
            pass
        with open(path, "a") as f:
            for log in logs:
                f.write(json.dumps(log, separators=(",", ":")) + "\n")


def hec_events(body):
    """HEC batches are JSON objects back to back (optionally newline-separated), not an array."""
    dec, i, out = json.JSONDecoder(), 0, []
    text = body.decode("utf-8", "replace")
    while i < len(text):
        while i < len(text) and text[i] in " \r\n\t":
            i += 1
        if i >= len(text):
            break
        obj, i = dec.raw_decode(text, i)
        out.append(obj)
    return out


class H(BaseHTTPRequestHandler):
    server_version = "loglab-receiver"

    def log_message(self, fmt, *args):  # quiet; errors go to stderr via send_json
        pass

    def send_json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)
        if code >= 400:
            print(f"{code} {self.command} {self.path}: {obj}", file=sys.stderr, flush=True)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def do_GET(self):
        if self.path == "/healthz":
            return self.send_json(200, {"ok": True})
        m = re.fullmatch(r"/splunk/([a-z0-9_-]+)/services/collector/health/?(\?.*)?", self.path)
        if m and m.group(1) in INSTANCES:
            return self.send_json(200, {"text": "HEC is healthy", "code": 17})
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        m = re.fullmatch(r"/webhook/([a-z0-9_-]+)/([a-z]+)/?", self.path)
        if m:
            inst, typ = m.groups()
            if inst not in INSTANCES or typ not in TYPES:
                return self.send_json(404, {"error": "unknown instance or log type"})
            try:
                js = json.loads(self.body() or b"{}")
            except ValueError as e:
                return self.send_json(400, {"error": f"bad json: {e}"})
            logs = js.get("details") if isinstance(js, dict) and "details" in js else [js]
            append(inst, f"webhook-{typ}.jsonl", logs or [])
            return self.send_json(200, {"received": len(logs or [])})
        m = re.fullmatch(r"/splunk/([a-z0-9_-]+)/services/collector(/event)?/?(\?.*)?", self.path)
        if m:
            inst = m.group(1)
            if inst not in INSTANCES:
                return self.send_json(404, {"text": "unknown instance", "code": 404})
            try:
                want = open(TOKEN_FILE).read().strip()
            except OSError:
                want = ""
            auth = self.headers.get("Authorization", "")
            if not auth.startswith("Splunk "):
                return self.send_json(401, {"text": "Token is required", "code": 2})
            if not want or auth[len("Splunk "):].strip() != want:
                return self.send_json(403, {"text": "Invalid token", "code": 4})
            try:
                evs = hec_events(self.body())
            except ValueError as e:
                return self.send_json(400, {"text": f"Invalid data format: {e}", "code": 6})
            append(inst, "splunk.jsonl", [e.get("event", e) if isinstance(e, dict) else e for e in evs])
            return self.send_json(200, {"text": "Success", "code": 0})
        self.send_json(404, {"error": "not found"})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 18200
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    print(f"loglab receiver listening on 127.0.0.1:{port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
