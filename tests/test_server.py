import http.client
import json
from pathlib import Path
import threading
import unittest
from backend.server import create_server

BASE = json.loads((Path(__file__).resolve().parents[1] / "test-data/cases.json").read_text())[0]["input"]


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = create_server(port=0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def request(self, method, path, payload=None, raw=None, content_type="application/json", content_length=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=10)
        try:
            body = raw if raw is not None else (json.dumps(payload) if payload is not None else None)
            headers = {"Content-Type": content_type}
            if content_length is not None:
                headers["Content-Length"] = str(content_length)
            connection.request(method, path, body, headers)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def result(self, path, payload):
        status, _, body = self.request("POST", path, payload)
        self.assertEqual(status, 200)
        return json.loads(body)

    def test_health_and_static_files(self):
        status, _, body = self.request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["engine"], "python")
        for path, mime in (("/", "text/html"), ("/app.mjs", "text/javascript"),
                           ("/theme-init.js", "text/javascript"), ("/styles.css", "text/css")):
            status, headers, _ = self.request("GET", path)
            self.assertEqual(status, 200)
            self.assertTrue(headers["Content-Type"].startswith(mime))

    def test_plan_and_check(self):
        output = self.result("/api/plan", {"input": BASE})
        self.assertTrue(output["ok"])
        self.assertEqual(output["engine"], "python")
        self.assertTrue(self.result("/api/check", {"input": BASE, "plan": output["plan"]})["valid"])
        self.assertFalse(self.result("/api/plan", {"input": {}})["ok"])

    def test_import_and_repair(self):
        output = self.result("/api/validate-response", {"input": BASE, "rawOutput": "bad json"})
        self.assertIsNone(output["validation"])
        self.assertIn("not valid JSON", output["error"])
        self.assertTrue(output["repairPrompt"])
        plan = self.result("/api/plan", {"input": BASE})["plan"]
        output = self.result("/api/validate-response", {"input": BASE, "rawOutput": json.dumps(plan)})
        self.assertTrue(output["validation"]["valid"])
        self.assertEqual(output["repairPrompt"], "")

    def test_csv_export(self):
        plan = self.result("/api/plan", {"input": BASE})["plan"]
        status, headers, body = self.request("POST", "/api/export", {"input": BASE, "plan": plan})
        self.assertEqual(status, 200)
        self.assertIn("text/csv", headers["Content-Type"])
        self.assertTrue(body.startswith(b'"Date","Subject","Hours","Task"'))
        self.assertEqual(self.request("POST", "/api/export", {"input": BASE, "plan": {}})[0], 422)

    def test_prompt_and_evaluation_endpoints(self):
        status, _, body = self.request("GET", "/api/prompts")
        self.assertEqual(status, 200)
        self.assertEqual(set(json.loads(body)["templates"]), {"v1", "v2", "v3"})
        status, _, body = self.request("GET", "/api/evaluation")
        self.assertEqual(status, 200)
        self.assertEqual(sum(r["pass"] for r in json.loads(body)["results"]), 16)

    def test_bad_requests_and_private_files(self):
        for raw in ("not json", "[]", '{"input":NaN}', '{"input":1e999}'):
            self.assertEqual(self.request("POST", "/api/plan", raw=raw)[0], 400)
        self.assertEqual(self.request("POST", "/api/plan", raw="{}", content_type="text/plain")[0], 415)
        # Oversized requests are rejected from the headers, before reading a body.
        self.assertEqual(self.request("POST", "/api/plan", content_length=1_000_001)[0], 413)
        for path in ("/../app.py", "/%2e%2e/.git/config", "/.env", "/api/missing", "/planner.mjs"):
            self.assertIn(self.request("GET", path)[0], (403, 404))


class VercelApiTests(ApiTests):
    """Run the API suite through the exact path Vercel rewrites to."""
    @classmethod
    def setUpClass(cls):
        from http.server import ThreadingHTTPServer
        from api.index import handler
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    def request(self, method, path, *args, **kwargs):
        from urllib.parse import quote
        target = "/api?__path=" + quote(path, safe="")
        return super().request(method, target, *args, **kwargs)


if __name__ == "__main__":
    unittest.main()
