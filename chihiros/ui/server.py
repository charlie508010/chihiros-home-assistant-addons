#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import Request, urlopen


ROOT = Path("/opt/chihiros-addon-ui")
BUNDLED_PLUGIN_ROOT = ROOT / "plugins"
PLUGIN_ROOT = Path("/config/chihiros/plugins")
CORE_API = "http://supervisor/core/api"
TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/states":
            self.proxy_core("GET", "/states")
            return
        if parsed.path == "/api/plugins":
            self.send_json(200, {"plugins": self.list_plugins()})
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/ctl":
            self.run_ctl(self.read_json())
            return
        if parsed.path == "/api/plugins/upload":
            self.upload_plugin()
            return
        if parsed.path == "/api/plugins/install-bundled":
            self.install_bundled_plugin(self.read_json())
            return
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

    def install_bundled_plugin(self, body: bytes) -> None:
        try:
            data = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self.send_json(400, {"message": "Invalid JSON"})
            return
        plugin_id = self.safe_plugin_id(str(data.get("id") or ""))
        if not plugin_id:
            self.send_json(400, {"message": "Ungueltige Plugin-ID"})
            return
        source = BUNDLED_PLUGIN_ROOT / plugin_id
        manifest = source / "plugin.json"
        if not manifest.is_file():
            self.send_json(404, {"message": "Mitgeliefertes Plugin nicht gefunden"})
            return
        try:
            installed = self.install_plugin_directory(source)
        except Exception as err:
            self.send_json(500, {"message": str(err)})
            return
        self.send_json(200, {"message": "Plugin installed", "plugin": installed, "plugins": self.list_plugins()})

    def list_plugins(self) -> list[dict[str, object]]:
        plugins: list[dict[str, object]] = []
        if not PLUGIN_ROOT.exists():
            return plugins
        for manifest in sorted(PLUGIN_ROOT.glob("*/plugin.json")):
            try:
                data = json.loads(manifest.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            plugin_id = self.safe_plugin_id(str(data.get("id") or manifest.parent.name))
            if not plugin_id:
                continue
            plugins.append(
                {
                    "id": plugin_id,
                    "name": str(data.get("name") or plugin_id),
                    "version": str(data.get("version") or ""),
                    "tab": str(data.get("tab") or data.get("name") or plugin_id),
                    "installed": True,
                }
            )
        return plugins

    def upload_plugin(self) -> None:
        try:
            filename, payload = self.read_upload_file()
            plugin_id = self.install_plugin_archive(filename, payload)
        except ValueError as err:
            self.send_json(400, {"message": str(err)})
            return
        except Exception as err:
            self.send_json(500, {"message": str(err)})
            return
        self.send_json(200, {"message": "Plugin installed", "plugin": plugin_id, "plugins": self.list_plugins()})

    def read_upload_file(self) -> tuple[str, bytes]:
        content_type = self.headers.get("content-type", "")
        boundary_match = re.search(r"boundary=(?P<boundary>[^;]+)", content_type)
        if not boundary_match:
            raise ValueError("Upload muss multipart/form-data sein")
        boundary = boundary_match.group("boundary").strip().strip('"').encode("utf-8")
        length = int(self.headers.get("content-length", "0") or "0")
        if length <= 0:
            raise ValueError("Keine Datei hochgeladen")
        body = self.rfile.read(length)
        for part in body.split(b"--" + boundary):
            if b"filename=" not in part:
                continue
            head, _, data = part.partition(b"\r\n\r\n")
            if not data:
                continue
            disposition = head.decode("utf-8", errors="ignore")
            name_match = re.search(r'filename="(?P<name>[^"]+)"', disposition)
            filename = Path(name_match.group("name") if name_match else "plugin.zip").name
            data = data.rsplit(b"\r\n", 1)[0]
            if not data:
                raise ValueError("Upload-Datei ist leer")
            return filename, data
        raise ValueError("Keine Plugin-Datei im Upload gefunden")

    def install_plugin_archive(self, filename: str, payload: bytes) -> str:
        suffix = filename.lower()
        if not (suffix.endswith(".zip") or suffix.endswith(".tgz") or suffix.endswith(".tar.gz")):
            raise ValueError("Nur .zip, .tgz oder .tar.gz Plugins sind erlaubt")
        PLUGIN_ROOT.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp_name:
            tmp = Path(tmp_name)
            archive = tmp / filename
            archive.write_bytes(payload)
            extract_dir = tmp / "extract"
            extract_dir.mkdir()
            if suffix.endswith(".zip"):
                with zipfile.ZipFile(archive) as zf:
                    self.safe_extract_zip(zf, extract_dir)
            else:
                with tarfile.open(archive) as tf:
                    self.safe_extract_tar(tf, extract_dir)
            manifest = self.find_plugin_manifest(extract_dir)
            data = json.loads(manifest.read_text(encoding="utf-8"))
            plugin_id = self.safe_plugin_id(str(data.get("id") or manifest.parent.name))
            if not plugin_id:
                raise ValueError("plugin.json enthaelt keine gueltige id")
            target = PLUGIN_ROOT / plugin_id
            self.copy_plugin_tree(manifest.parent, target)
            return plugin_id

    def install_plugin_directory(self, source: Path) -> str:
        data = json.loads((source / "plugin.json").read_text(encoding="utf-8"))
        plugin_id = self.safe_plugin_id(str(data.get("id") or source.name))
        if not plugin_id:
            raise ValueError("plugin.json enthaelt keine gueltige id")
        target = PLUGIN_ROOT / plugin_id
        PLUGIN_ROOT.mkdir(parents=True, exist_ok=True)
        self.copy_plugin_tree(source, target)
        return plugin_id

    def copy_plugin_tree(self, source: Path, target: Path) -> None:
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(source, target)

    def find_plugin_manifest(self, root: Path) -> Path:
        manifests = list(root.glob("plugin.json")) + list(root.glob("*/plugin.json"))
        if not manifests:
            raise ValueError("Plugin enthaelt keine plugin.json")
        return manifests[0]

    def safe_plugin_id(self, value: str) -> str:
        value = value.strip().lower().replace("-", "_")
        return value if re.fullmatch(r"[a-z0-9_]+", value) else ""

    def safe_extract_zip(self, archive: zipfile.ZipFile, target: Path) -> None:
        root = target.resolve()
        for info in archive.infolist():
            destination = (target / info.filename).resolve()
            if not str(destination).startswith(str(root)):
                raise ValueError("Plugin-Archiv enthaelt ungueltige Pfade")
        archive.extractall(target)

    def safe_extract_tar(self, archive: tarfile.TarFile, target: Path) -> None:
        root = target.resolve()
        for member in archive.getmembers():
            destination = (target / member.name).resolve()
            if not str(destination).startswith(str(root)):
                raise ValueError("Plugin-Archiv enthaelt ungueltige Pfade")
        archive.extractall(target)

    def run_ctl(self, body: bytes) -> None:
        try:
            data = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self.send_json(400, {"message": "Invalid JSON"})
            return
        command = str(data.get("command", "")).strip()
        if not command:
            self.send_json(400, {"message": "Missing command"})
            return
        parts = command.split()
        if not parts or parts[0] != "chihirosctl":
            self.send_json(400, {"message": "Only chihirosctl commands are allowed"})
            return
        if len(parts) >= 3 and parts[1] == "doser" and parts[2] == "gui":
            self.send_json(
                400,
                {
                    "message": "GUI commands are not available inside the Home Assistant add-on container.",
                    "output": "Use the Add-on UI tabs or a non-GUI chihirosctl command.",
                },
            )
            return
        if any(token in command for token in [";", "&", "|", "`", "$(", ">", "<"]):
            self.send_json(400, {"message": "Shell operators are not allowed"})
            return
        try:
            result = subprocess.run(
                parts,
                cwd="/opt/chihiros-src",
                env={
                    **os.environ,
                    "CHIHIROS_STATE_DB": "/config/.chihiros/chihiros_state.sqlite3",
                    "PYTHONPATH": "/opt/chihiros-src/custom_components/chihiros/vendor:/opt/chihiros-src",
                },
                text=True,
                capture_output=True,
                timeout=120,
                check=False,
            )
        except subprocess.TimeoutExpired:
            self.send_json(504, {"message": "Command timed out"})
            return
        output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
        self.send_json(
            200 if result.returncode == 0 else 500,
            {
                "returncode": result.returncode,
                "output": output or "(no output)",
            },
        )

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
