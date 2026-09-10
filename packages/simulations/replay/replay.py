"""Portable replay runner for DT simulation packs."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
REGISTRY = ROOT / "registry.json"
RUNS = ROOT / "runs"


def now_id():
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")


def sha256(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_registry():
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


def find_sim(sim_id):
    for item in load_registry()["simulations"]:
        if item["simulation_id"] == sim_id:
            return item
    raise SystemExit(f"Unknown simulation_id: {sim_id}")


def list_sims():
    for item in load_registry()["simulations"]:
        runnable = "yes" if item.get("entrypoint") else "no"
        print(f"{item['simulation_id']}\trunnable={runnable}\t{item['status']}")


def file_inventory(root: Path):
    rows = []
    for path in sorted(root.rglob("*")):
        if path.is_file():
            rows.append({
                "path": str(path.relative_to(root)).replace("\\", "/"),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })
    return rows


def run_sim(item, python_exe, extra_args):
    entry = item.get("entrypoint")
    if not entry:
        raise SystemExit(
            f"{item['simulation_id']} is not runnable: {item['status']}"
        )
    entry_path = ROOT / entry
    run_dir = RUNS / item["simulation_id"] / now_id()
    output_dir = run_dir / "outputs"
    output_dir.mkdir(parents=True, exist_ok=False)
    command = [python_exe, str(entry_path), "--out-dir", str(output_dir)]
    command.extend(item.get("default_args", []))
    command.extend(extra_args)
    started = datetime.now(timezone.utc).isoformat()
    proc = subprocess.run(command, text=True, capture_output=True, cwd=str(ROOT))
    finished = datetime.now(timezone.utc).isoformat()
    (run_dir / "stdout.txt").write_text(proc.stdout, encoding="utf-8")
    (run_dir / "stderr.txt").write_text(proc.stderr, encoding="utf-8")
    receipt = {
        "schema_version": "1.0",
        "run_id": run_dir.name,
        "simulation_id": item["simulation_id"],
        "source_class": item["source_class"],
        "registry_status_at_run": item["status"],
        "command": command,
        "cwd": str(ROOT),
        "started_at": started,
        "finished_at": finished,
        "return_code": proc.returncode,
        "execution_status": "EXECUTED_SUCCESS" if proc.returncode == 0 else "EXECUTED_FAILURE",
        "environment": {
            "python_executable": python_exe,
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "machine": platform.machine(),
        },
        "entrypoint": {
            "path": str(entry_path),
            "sha256": sha256(entry_path),
        },
        "outputs": file_inventory(output_dir),
    }
    receipt_path = run_dir / "receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(receipt, indent=2))
    return proc.returncode


def main():
    parser = argparse.ArgumentParser(description="Replay DT simulations with receipts")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--list", action="store_true")
    group.add_argument("--run", metavar="SIMULATION_ID")
    parser.add_argument("--python", default=sys.executable)
    args, extra = parser.parse_known_args()
    if args.list:
        list_sims()
        return 0
    item = find_sim(args.run)
    return run_sim(item, args.python, extra)


if __name__ == "__main__":
    raise SystemExit(main())
