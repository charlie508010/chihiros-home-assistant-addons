#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import Request, urlopen


ROOT = Path("/opt/chihiros-addon-ui")
CORE_API = "http://supervisor/core/api"
TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/states":
            self.proxy_core("GET", "/states")
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/services/"):
            parts = parsed.path.strip("/").split("/")
            if len(parts) != 4:
                self.send_json(404, {"message": "Invalid service path"})
                return
            _, _, domain, service = parts
            query = parse_qs(parsed.query)
            suffix = f"/services/{domain}/{service}"
            if "return_response" in query:
                suffix += "?return_response"
            self.proxy_core("POST", suffix, self.read_json())
            return
        self.send_json(404, {"message": "Not found"})

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def read_json(self) -> bytes:
        length = int(self.headers.get("content-length", "0") or "0")
        if length <= 0:
            return b"{}"
        body = self.rfile.read(length)
        try:
            json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return b"{}"
        return body

    def proxy_core(self, method: str, suffix: str, body: bytes | None = None) -> None:
        if not TOKEN:
            self.send_json(500, {"message": "SUPERVISOR_TOKEN is missing"})
            return
        request = Request(
            f"{CORE_API}{suffix}",
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urlopen(request, timeout=30) as response:
                data = response.read()
                self.send_response(response.status)
                self.send_header("content-type", response.headers.get("content-type", "application/json"))
                self.send_header("cache-control", "no-store")
                self.end_headers()
                self.wfile.write(data)
        except HTTPError as err:
            data = err.read()
            self.send_response(err.code)
            self.send_header("content-type", err.headers.get("content-type", "application/json"))
            self.send_header("cache-control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        except URLError as err:
            self.send_json(502, {"message": str(err)})

    def serve_static(self, raw_path: str) -> None:
        path = unquote(raw_path).lstrip("/") or "index.html"
        target = (ROOT / path).resolve()
        if not str(target).startswith(str(ROOT.resolve())) or not target.is_file():
            self.send_json(404, {"message": "Not found"})
            return
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("content-type", content_type)
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(target.read_bytes())

    def send_json(self, status: int, data: dict[str, object]) -> None:
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8099), Handler)
    print("Chihiros Beta web UI listening on port 8099")
    server.serve_forever()
