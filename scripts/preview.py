"""Serve local Cocos builds with fresh asset URLs and no browser caching."""
import argparse
import hashlib
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

BUILD_ROOT = Path(__file__).resolve().parent.parent / "build"
VERSION_PREFIX = re.compile(r"^/preview/[0-9a-f]{12}(?=/)")
ENTRY = re.compile(r"^/(?:preview/[0-9a-f]{12}/)?first-level/?$")


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        # Ignore validators left by the previous development server.
        for header in ("If-Modified-Since", "If-None-Match"):
            if header in self.headers:
                del self.headers[header]
        request = urlsplit(self.path)
        script = BUILD_ROOT / "first-level/assets/main/index.js"
        if ENTRY.fullmatch(request.path) and script.is_file():
            version = hashlib.sha256(script.read_bytes()).hexdigest()[:12]
            destination = "/preview/{}/first-level/".format(version)
            if request.path != destination:
                self.send_response(302)
                self.send_header("Location", destination + ("?" + request.query if request.query else ""))
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
        return super().send_head()

    def translate_path(self, path):
        return super().translate_path(VERSION_PREFIX.sub("", path))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4312)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(BUILD_ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print("Preview: http://127.0.0.1:{}/first-level/".format(args.port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
