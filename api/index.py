"""Vercel entry point; reuse the same Python handler as the local app."""
from urllib.parse import parse_qs, urlsplit
from backend.server import Handler


class handler(Handler):
    def restore_route(self):
        parsed = urlsplit(self.path)
        # Support both the original URL and the rewritten function URL.
        if parsed.path in ("/api/index", "/api/index.py"):
            self.path = parse_qs(parsed.query).get("__path", ["/"])[-1]
            if not self.path.startswith("/") or self.path.startswith("//"):
                self.path = "/invalid-route"

    def do_GET(self):
        self.restore_route()
        super().do_GET()

    def do_POST(self):
        self.restore_route()
        super().do_POST()
