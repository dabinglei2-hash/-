"""Dependency-free loopback preview with correct PWA MIME types. No private files/API."""
import argparse
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent


class Server(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**mimetypes.types_map, '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml'}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass  # No personal routes or request contents in logs.

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        decoded = unquote(urlsplit(self.path).path)
        target = (ROOT / decoded.lstrip('/')).resolve()
        if decoded == '/':
            self.path = '/index.html'
        elif not target.is_relative_to(ROOT) or any(part.startswith('.') for part in Path(decoded).parts) or not (
                target.parent == ROOT and target.suffix in ('.html', '.js', '.css', '.webmanifest') or
                target.is_relative_to(ROOT / 'assets') or target.is_relative_to(ROOT / 'vendor')) or not target.is_file():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        # Reuse the same path restrictions instead of serving arbitrary source files.
        self.send_error(405)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    Server(('127.0.0.1', args.port), Handler).serve_forever()
