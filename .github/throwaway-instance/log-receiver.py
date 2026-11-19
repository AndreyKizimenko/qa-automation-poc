"""The webhook log destination for the throwaway instance: prints each POST body on one line, prefixed by
its path, so `docker compose logs log-receiver` shows what Fleet's webhook logger delivered."""
import http.server
import sys


class Receiver(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        sys.stdout.write(self.path + ' ' + body.decode('utf-8', 'replace') + '\n')
        sys.stdout.flush()
        self.send_response(200)
        self.end_headers()

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer(('', 8000), Receiver).serve_forever()
