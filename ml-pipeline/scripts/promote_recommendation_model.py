"""
Promote a trained recommendation model candidate to active production model.

This script validates candidate artifacts and quality-gate status, archives the
current active model (if present), then copies candidate artifacts into the
active model directory used by ml-pipeline/api.py.
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


def _copy_tree(src: Path, dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        target = dst / item.name
        if item.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote recommendation model candidate")
    parser.add_argument("--candidate-dir", required=True, help="Candidate directory path")
    parser.add_argument(
        "--models-root",
        default="models",
        help="Models root directory (default: models)",
    )
    parser.add_argument(
        "--allow-failed-gate",
        action="store_true",
        help="Allow promotion even if training summary quality gates failed",
    )
    args = parser.parse_args()

    candidate_dir = Path(args.candidate_dir).expanduser().resolve()
    if not candidate_dir.exists():
        raise FileNotFoundError(f"Candidate directory not found: {candidate_dir}")

    summary_path = candidate_dir / "training_summary.json"
    model_path = candidate_dir / "xgb_ranker.model"

    if not summary_path.exists():
        raise FileNotFoundError(f"Missing training summary: {summary_path}")
    if not model_path.exists():
        raise FileNotFoundError(f"Missing model artifact: {model_path}")

    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    passed = bool(summary.get("gates", {}).get("passed", False))
    if not passed and not args.allow_failed_gate:
        reasons = summary.get("gates", {}).get("reasons", [])
        raise RuntimeError(
            "Cannot promote: candidate failed quality gate. "
            f"Use --allow-failed-gate to override. Reasons: {reasons}"
        )

    models_root = Path(args.models_root).expanduser().resolve()
    models_root.mkdir(parents=True, exist_ok=True)

    active_dir = models_root / "recommendation_active"
    archive_root = models_root / "recommendation_archive"
    archive_root.mkdir(parents=True, exist_ok=True)

    if active_dir.exists() and any(active_dir.iterdir()):
        archived = archive_root / datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        archived.mkdir(parents=True, exist_ok=True)
        _copy_tree(active_dir, archived)
        print("Archived previous active model to", archived)

    if active_dir.exists():
        shutil.rmtree(active_dir)
    active_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(model_path, active_dir / "xgb_ranker.model")
    shutil.copy2(summary_path, active_dir / "model_info.json")

    pointer_path = models_root / "recommendation_active_model.json"
    pointer = {
        "active_path": str((active_dir / "xgb_ranker.model").resolve()),
        "promoted_at": datetime.now(timezone.utc).isoformat(),
        "candidate_dir": str(candidate_dir),
        "model_info": str((active_dir / "model_info.json").resolve()),
    }
    pointer_path.write_text(json.dumps(pointer, indent=2), encoding="utf-8")

    print("Promotion complete")
    print("Active model:", pointer["active_path"])
    print("Pointer file:", pointer_path)


if __name__ == "__main__":
    main()
