"""Local HTTP interface for the Python engine and browser frontend."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit
from .evaluate import evaluate_cases
from .planner import check_plan, export_csv, generate_plan, parse_model_output, strict_json, validate_input

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "code"
MAX_BODY = 1_000_000
TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".svg": "image/svg+xml"}


def prompt_templates():
    return {"templates": {v: (ROOT / f"prompts/{v}/P1-study-plan.txt").read_text()
        for v in ("v1", "v2", "v3")}, "repairTemplate": (ROOT / "prompts/final/P2-repair.txt").read_text()}


def validate_response(data, raw):
    errors = validate_input(data)
    if errors:
        return {"inputErrors": errors}
    plan, validation, error = None, None, None
    try:
        plan = parse_model_output(raw)
        validation = check_plan(data, plan)
    except ValueError as exc:
        error = str(exc)
    issues = [error] if error else validation["violations"] + [
        f"{s['name']}: {s['remaining']:g}h unallocated. If infeasible, keep the shortfall and explain why."
        for s in validation["coverage"] if s["remaining"] > 0]
    repair = prompt_templates()["repairTemplate"].replace("{issues}", "\n".join("- " + i for i in issues)) if issues else ""
    if validation and validation["valid"]:
        plan = {"days": sorted(plan["days"], key=lambda d: d["date"])}
    return {"plan": plan, "validation": validation, "error": error, "repairPrompt": repair, "engine": "python"}


class Handler(BaseHTTPRequestHandler):
    server_version = "StudyflowPython/1.0"

    def respond(self, status, value, content_type="application/json; charset=utf-8", headers=None):
        body = json.dumps(value, ensure_ascii=False, allow_nan=False).encode() if content_type.startswith("application/json") else value
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/health":
            return self.respond(200, {"ok": True, "engine": "python"})
        if path == "/api/prompts":
            return self.respond(200, prompt_templates())
        if path == "/api/evaluation":
            return self.respond(200, evaluate_cases())
        if path.startswith("/api/"):
            return self.respond(404, {"error": "Unknown API endpoint."})
        try:
            file = (STATIC / unquote(path).lstrip("/")).resolve() if path != "/" else STATIC / "index.html"
            if not file.is_relative_to(STATIC.resolve()):
                return self.respond(403, {"error": "Forbidden."})
            if not file.is_file() or file.suffix not in TYPES:
                return self.respond(404, {"error": "File not found."})
            return self.respond(200, file.read_bytes(), TYPES[file.suffix])
        except (OSError, ValueError):
            return self.respond(404, {"error": "File not found."})

    def do_POST(self):
        # The app uses same-origin fetch. Do not allow browser forms to mutate API data.
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            return self.respond(415, {"error": "Send an application/json request."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BODY:
                return self.respond(413, {"error": "Request must be between 1 byte and 1 MB."})
            payload = strict_json(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("The request must be a JSON object.")
        except (ValueError, UnicodeDecodeError, RecursionError):
            return self.respond(400, {"error": "Invalid JSON request."})
        path, data = urlsplit(self.path).path, payload.get("input")
        if path == "/api/plan":
            return self.respond(200, generate_plan(data))
        if path == "/api/validate-input":
            return self.respond(200, {"errors": validate_input(data)})
        if path == "/api/check":
            return self.respond(200, check_plan(data, payload.get("plan")))
        if path == "/api/validate-response":
            return self.respond(200, validate_response(data, payload.get("rawOutput")))
        if path == "/api/export":
            try:
                csv = export_csv(data, payload.get("plan"))
            except ValueError as exc:
                return self.respond(422, {"error": str(exc)})
            return self.respond(200, csv.encode("utf-8"), "text/csv; charset=utf-8",
                {"Content-Disposition": 'attachment; filename="studyflow-plan.csv"'})
        return self.respond(404, {"error": "Unknown API endpoint."})


def create_server(host="127.0.0.1", port=5173):
    return ThreadingHTTPServer((host, port), Handler)
