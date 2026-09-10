"""Create an isolated Python environment for all runnable replay packs."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parent
VENV = ROOT / ".venv"


def venv_python():
    if sys.platform == "win32":
        return VENV / "Scripts" / "python.exe"
    return VENV / "bin" / "python"


def main():
    registry = json.loads((ROOT / "registry.json").read_text(encoding="utf-8"))
    reqs = []
    for item in registry["simulations"]:
        req = item.get("requirements")
        if req and req not in reqs:
            reqs.append(req)
    if not VENV.exists():
        venv.EnvBuilder(with_pip=True).create(VENV)
    py = venv_python()
    for req in reqs:
        subprocess.check_call([str(py), "-m", "pip", "install", "--disable-pip-version-check", "-r", str(ROOT / req)])
    print(str(py))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
