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

if [[ "${KEEP_RUNNING}" == "true" ]]; then
  tail -f /dev/null
fi
