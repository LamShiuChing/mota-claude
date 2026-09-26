# Dev server for the repo root that tells the browser never to cache, so edits show on a plain reload.
# Usage: python tools/serve.py [port]   (default 8765)
import functools, http.server, pathlib, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

root = pathlib.Path(__file__).resolve().parent.parent
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(NoCache, directory=str(root))).serve_forever()
