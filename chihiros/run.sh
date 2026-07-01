#!/usr/bin/env bash
set -euo pipefail

OPTIONS_FILE="/data/options.json"
SOURCE_REPOSITORY="https://github.com/charlie508010/chihiros-led-control-beta.git"
SOURCE_BRANCH="main"
INSTALL_INTEGRATION="true"
KEEP_RUNNING="true"

if [[ -f "${OPTIONS_FILE}" ]]; then
  SOURCE_REPOSITORY="$(python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("/data/options.json").read_text())
print(str(data.get("source_repository", "https://github.com/charlie508010/chihiros-led-control-beta.git")))
PY
)"
  SOURCE_BRANCH="$(python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("/data/options.json").read_text())
print(str(data.get("source_branch", "main")))
PY
)"
  INSTALL_INTEGRATION="$(python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("/data/options.json").read_text())
print(str(data.get("install_integration", True)).lower())
PY
)"
  KEEP_RUNNING="$(python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("/data/options.json").read_text())
print(str(data.get("keep_running", True)).lower())
PY
)"
fi

rm -rf /opt/chihiros-src
git clone --depth 1 --branch "${SOURCE_BRANCH}" "${SOURCE_REPOSITORY}" /opt/chihiros-src

if [[ "${INSTALL_INTEGRATION}" == "true" ]]; then
  mkdir -p /config/custom_components
  rm -rf /config/custom_components/chihiros
  cp -a /opt/chihiros-src/custom_components/chihiros /config/custom_components/chihiros
  find /config/custom_components/chihiros -type d \( -name __pycache__ -o -name .venv -o -name temp -o -name hci_log -o -name captures \) -prune -exec rm -rf {} +
  echo "Chihiros integration installed to /config/custom_components/chihiros"
  echo "Restart Home Assistant after first install or update."
fi

echo "Chihiros Beta is running. Built-in CTL command is available as chihirosctl inside this add-on container."

mkdir -p /tmp/chihiros-web
cat > /tmp/chihiros-web/index.html <<'HTML'
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chihiros Beta</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: #101818;
      color: #e8eeee;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      max-width: 760px;
      margin: 0 auto;
      border: 1px solid #1f5664;
      border-radius: 8px;
      padding: 20px;
      background: #122020;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 24px;
    }
    code {
      display: block;
      padding: 12px;
      background: #071010;
      border: 1px solid #26464c;
      border-radius: 6px;
      color: #bcefff;
      overflow-x: auto;
    }
    .ok {
      color: #55d66b;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main>
    <h1>Chihiros Beta</h1>
    <p class="ok">Add-on laeuft.</p>
    <p>Die Home-Assistant-Integration wird aus dem Beta-Hauptrepo installiert. CTL ist in dieser Version enthalten.</p>
    <code>chihirosctl doser show-schedules doser_1</code>
    <p>Nach Installation oder Update Home Assistant neu starten.</p>
  </main>
</body>
</html>
HTML

python3 -m http.server 8099 --directory /tmp/chihiros-web &

if [[ "${KEEP_RUNNING}" == "true" ]]; then
  wait
fi
