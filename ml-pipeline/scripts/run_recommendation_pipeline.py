"""
Run the end-to-end recommendation training pipeline.

Pipeline steps:
1) Export feedback dataset from Neo4j
2) Evaluate offline metrics
3) Train candidate ranker with quality gates
4) Optionally promote candidate to active model

The script exits non-zero on any failed command, making it suitable for
cron jobs, CI workflows, or release pipelines.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List


def _run_step(cmd: List[str], cwd: Path) -> None:
    print("\n$", " ".join(cmd))
    proc = subprocess.run(cmd, cwd=str(cwd))
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {proc.returncode}: {' '.join(cmd)}")


def _new_candidate_dir(candidates_root: Path, before: set[str]) -> Path:
    after_dirs = sorted(
        [p for p in candidates_root.glob("ranker-*") if p.is_dir()],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not after_dirs:
        raise RuntimeError(f"No candidate directories found in {candidates_root}")

    for path in after_dirs:
        if str(path.resolve()) not in before:
            return path

    # Fallback to most recent if diff cannot be detected.
    return after_dirs[0]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run recommendation training + promotion pipeline")
    parser.add_argument("--python", default=sys.executable, help="Python executable path")
    parser.add_argument(
        "--dataset-output",
        default="data/training/recommendation_feedback_dataset.csv",
        help="Path for exported feedback dataset CSV (relative to ml-pipeline)",
    )
    parser.add_argument(
        "--metrics-output",
        default="models/recommendation_eval_metrics.json",
        help="Path for offline metrics JSON (relative to ml-pipeline)",
    )
    parser.add_argument(
        "--candidates-root",
        default="models/recommendation_candidates",
        help="Candidate model root directory (relative to ml-pipeline)",
    )
    parser.add_argument("--days-back", type=int, default=180)
    parser.add_argument("--decay-half-life-days", type=int, default=90)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--min-user-rows", type=int, default=5)
    parser.add_argument("--validation-ratio", type=float, default=0.2)
    parser.add_argument("--min-ndcg5", type=float, default=0.25)
    parser.add_argument("--min-ndcg10", type=float, default=0.35)
    parser.add_argument("--min-delta-ndcg5", type=float, default=0.0)
    parser.add_argument("--min-delta-ndcg10", type=float, default=0.0)
    parser.add_argument("--num-boost-round", type=int, default=240)
    parser.add_argument("--max-depth", type=int, default=6)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument(
        "--no-promote",
        action="store_true",
        help="Run export/eval/train only without promoting candidate",
    )
    args = parser.parse_args()

    ml_root = Path(__file__).resolve().parents[1]
    scripts = ml_root / "scripts"

    dataset_output = ml_root / args.dataset_output
    metrics_output = ml_root / args.metrics_output
    candidates_root = ml_root / args.candidates_root

    dataset_output.parent.mkdir(parents=True, exist_ok=True)
    metrics_output.parent.mkdir(parents=True, exist_ok=True)
    candidates_root.mkdir(parents=True, exist_ok=True)

    before_candidates = {str(p.resolve()) for p in candidates_root.glob("ranker-*") if p.is_dir()}

    _run_step(
        [
            args.python,
            str(scripts / "export_recommendation_feedback_dataset.py"),
            "--output",
            str(dataset_output),
            "--days-back",
            str(args.days_back),
            "--decay-half-life-days",
            str(args.decay_half_life_days),
        ],
        ml_root,
    )

    _run_step(
        [
            args.python,
            str(scripts / "evaluate_recommendation_ranking.py"),
            "--dataset",
            str(dataset_output),
            "--score-column",
            "served_score",
            "--label-column",
            "label",
            "--output-json",
            str(metrics_output),
        ],
        ml_root,
    )

    _run_step(
        [
            args.python,
            str(scripts / "train_recommendation_ranker.py"),
            "--dataset",
            str(dataset_output),
            "--output-root",
            str(candidates_root),
            "--seed",
            str(args.seed),
            "--min-user-rows",
            str(args.min_user_rows),
            "--validation-ratio",
            str(args.validation_ratio),
            "--min-ndcg5",
            str(args.min_ndcg5),
            "--min-ndcg10",
            str(args.min_ndcg10),
            "--baseline-metrics",
            str(metrics_output),
            "--min-delta-ndcg5",
            str(args.min_delta_ndcg5),
            "--min-delta-ndcg10",
            str(args.min_delta_ndcg10),
            "--num-boost-round",
            str(args.num_boost_round),
            "--max-depth",
            str(args.max_depth),
            "--learning-rate",
            str(args.learning_rate),
        ],
        ml_root,
    )

    candidate_dir = _new_candidate_dir(candidates_root, before_candidates)
    promoted = False

    if not args.no_promote:
        _run_step(
            [
                args.python,
                str(scripts / "promote_recommendation_model.py"),
                "--candidate-dir",
                str(candidate_dir),
                "--models-root",
                str(ml_root / "models"),
            ],
            ml_root,
        )
        promoted = True

    summary = {
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "dataset_output": str(dataset_output),
        "metrics_output": str(metrics_output),
        "candidate_dir": str(candidate_dir),
        "promoted": promoted,
    }

    summary_path = ml_root / "models" / "recommendation_pipeline_last_run.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\nPipeline completed successfully")
    print("Candidate:", candidate_dir)
    print("Promoted:", promoted)
    print("Summary:", summary_path)


if __name__ == "__main__":
    main()
