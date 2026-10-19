import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import eyetime_companion as c

TOKEN = "secret-token-abcdefghijklmnop"


class FakeBackend:
    def __init__(self, app="code", idle=0.0):
        self.app, self.idle = app, idle

    def foreground_app(self):
        return self.app

    def idle_seconds(self):
        return self.idle


class Core(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.store = c.Store(self.dir + "/d.json")

    def tick(self, backend, n=1, elapsed=1.0):
        t = c.Tracker(backend, self.store, day_fn=lambda: "2026-10-19")
        for _ in range(n):
            t.sample(elapsed)

    def test_counts_foreground_app_by_friendly_name(self):
        self.tick(FakeBackend("code"), 3)
        self.assertEqual(self.store.today("2026-10-19"), {"Visual Studio Code": 3.0})

    def test_browsers_idle_and_nothing_are_not_counted(self):
        self.tick(FakeBackend("chrome"), 5)
        self.tick(FakeBackend("figma", idle=500), 5)
        self.tick(FakeBackend(None), 5)
        self.assertEqual(self.store.today("2026-10-19"), {})

    def test_stalled_sample_is_capped(self):
        self.tick(FakeBackend("figma"), 1, elapsed=3600)
        self.assertEqual(self.store.today("2026-10-19")["Figma"], 5.0)

    def test_persistence_roundtrip_and_pruning(self):
        self.store.add("2026-10-19", "Figma", 10)
        self.store.flush()
        again = c.Store(self.dir + "/d.json")
        self.assertEqual(again.today("2026-10-19"), {"Figma": 10})
        for i in range(c.KEEP_DAYS + 5):
            again.add(f"2000-01-{i:05d}", "x", 1)
        again.flush()
        self.assertLessEqual(len(c.Store(self.dir + "/d.json").days), c.KEEP_DAYS)

    def test_friendly_names(self):
        self.assertEqual(c.friendly_name("slack"), "Slack")
        self.assertEqual(c.friendly_name("my_cool-app"), "My Cool App")

    def test_token_is_generated_once_and_reused(self):
        path = self.dir + "/t.txt"
        t1 = c.load_token(path)
        self.assertGreaterEqual(len(t1), 24)
        self.assertEqual(c.load_token(path), t1)
        self.assertNotEqual(c.load_token(path, rotate=True), t1)


class Http(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = c.Store(tempfile.mkdtemp() + "/d.json")
        cls.store.add("2026-10-19", "Figma", 42)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandlerPlaceholder)
        cls.port = cls.server.server_address[1]
        cls.server.RequestHandlerClass = c.make_handler(cls.store, TOKEN, day_fn=lambda: "2026-10-19", port=cls.port)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def get(self, path="/v1/today", headers=None):
        h = {"Authorization": f"Bearer {TOKEN}"}
        h.update(headers or {})
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", headers=h)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read()), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}"), dict(e.headers)

    def test_authorised_request_returns_totals(self):
        code, body, headers = self.get()
        self.assertEqual(code, 200)
        self.assertEqual(body["apps"], {"Figma": 42})
        self.assertNotIn("Access-Control-Allow-Origin", headers)  # never CORS-open

    def test_missing_or_wrong_token_is_rejected(self):
        self.assertEqual(self.get(headers={"Authorization": "Bearer nope"})[0], 401)
        self.assertEqual(self.get(headers={"Authorization": ""})[0], 401)

    def test_web_page_origin_is_rejected_even_with_token(self):
        self.assertEqual(self.get(headers={"Origin": "https://evil.example"})[0], 403)

    def test_extension_origin_is_allowed(self):
        self.assertEqual(self.get(headers={"Origin": "chrome-extension://abcdef"})[0], 200)

    def test_rebinding_host_is_rejected(self):
        self.assertEqual(self.get(headers={"Host": "evil.example"})[0], 403)

    def test_unknown_path_and_write_methods(self):
        self.assertEqual(self.get("/v1/other")[0], 404)
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/v1/today", data=b"{}", method="POST", headers={"Authorization": f"Bearer {TOKEN}"})
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req)
        self.assertIn(cm.exception.code, (501, 405))  # no POST handler at all


from http.server import BaseHTTPRequestHandler as BaseHTTPRequestHandlerPlaceholder  # noqa: E402

if __name__ == "__main__":
    unittest.main()
