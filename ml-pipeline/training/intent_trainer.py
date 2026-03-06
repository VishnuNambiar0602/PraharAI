"""
Intent Classifier Trainer

Fine-tunes a DistilBERT model for intent classification on PraharAI query data.
Reads training data produced by data_extractor.py and saves a trained model
to ml-pipeline/models/.
"""

import sys
import os
import json
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Any

import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    get_linear_schedule_with_warmup,
)
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
)

# Intent labels — defined inline to avoid importing intent_classifier.py
# which pulls in heavy onnxruntime / torch at module level.
INTENT_LABELS = [
    "scheme_search",
    "eligibility_check",
    "application_info",
    "deadline_query",
    "profile_update",
    "general_question",
    "nudge_preferences",
]


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------


class IntentDataset(Dataset):
    """PyTorch dataset for intent classification."""

    def __init__(
        self,
        data: List[Dict[str, str]],
        tokenizer,
        max_length: int = 128,
    ):
        self.queries = [d["query"] for d in data]
        self.labels = [INTENT_LABELS.index(d["intent"]) for d in data]
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.queries)

    def __getitem__(self, idx):
        enc = self.tokenizer(
            self.queries[idx],
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt",
        )
        return {
            "input_ids": enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "labels": torch.tensor(self.labels[idx], dtype=torch.long),
        }


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------


def train_epoch(
    model,
    loader: DataLoader,
    optimizer,
    scheduler,
    device: torch.device,
) -> float:
    model.train()
    total_loss = 0.0
    for batch in loader:
        optimizer.zero_grad()
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["labels"].to(device)

        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels,
        )
        loss = outputs.loss
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()
        total_loss += loss.item()

    return total_loss / len(loader)


def evaluate(
    model,
    loader: DataLoader,
    device: torch.device,
) -> Dict[str, Any]:
    model.eval()
    all_preds: List[int] = []
    all_labels: List[int] = []
    total_loss = 0.0

    with torch.no_grad():
        for batch in loader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels,
            )
            total_loss += outputs.loss.item()
            preds = torch.argmax(outputs.logits, dim=-1)
            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(labels.cpu().tolist())

    accuracy = accuracy_score(all_labels, all_preds)
    precision, recall, f1, _ = precision_recall_fscore_support(
        all_labels,
        all_preds,
        average="weighted",
        zero_division=0,
    )
    return {
        "loss": total_loss / max(len(loader), 1),
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Fine-tune DistilBERT for intent classification")
    parser.add_argument(
        "--train-data",
        default="data/training/intent_train.json",
        help="Path to training JSON (default: data/training/intent_train.json)",
    )
    parser.add_argument(
        "--val-data",
        default="data/training/intent_val.json",
        help="Path to validation JSON (default: data/training/intent_val.json)",
    )
    parser.add_argument(
        "--model-name",
        default="distilbert-base-uncased",
        help="Pretrained model name (default: distilbert-base-uncased)",
    )
    parser.add_argument(
        "--output-dir",
        default="models/intent_classifier",
        help="Directory to save trained model (default: models/intent_classifier)",
    )
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--max-length", type=int, default=128)
    parser.add_argument("--seed", type=int, default=42)

    args = parser.parse_args()

    # Reproducibility
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\nDevice: {device}")

    # ── Load data ────────────────────────────────────────────────────────
    print(f"Loading training data from {args.train_data} ...")
    with open(args.train_data) as f:
        train_data = json.load(f)
    print(f"  {len(train_data)} training samples")

    val_data = []
    if os.path.exists(args.val_data):
        with open(args.val_data) as f:
            val_data = json.load(f)
        print(f"  {len(val_data)} validation samples")

    # ── Tokenizer & model ────────────────────────────────────────────────
    print(f"\nLoading {args.model_name} ...")
    tokenizer = AutoTokenizer.from_pretrained(args.model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model_name,
        num_labels=len(INTENT_LABELS),
    ).to(device)

    # ── Datasets & loaders ───────────────────────────────────────────────
    train_ds = IntentDataset(train_data, tokenizer, args.max_length)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)

    val_loader = None
    if val_data:
        val_ds = IntentDataset(val_data, tokenizer, args.max_length)
        val_loader = DataLoader(val_ds, batch_size=args.batch_size)

    # ── Optimizer & scheduler ────────────────────────────────────────────
    total_steps = len(train_loader) * args.epochs
    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=int(total_steps * 0.1),
        num_training_steps=total_steps,
    )

    # ── Training ─────────────────────────────────────────────────────────
    print(f"\nTraining for {args.epochs} epochs ...")
    print("-" * 60)

    best_f1 = 0.0
    history: List[Dict[str, Any]] = []

    for epoch in range(1, args.epochs + 1):
        train_loss = train_epoch(model, train_loader, optimizer, scheduler, device)
        row: Dict[str, Any] = {"epoch": epoch, "train_loss": train_loss}

        if val_loader:
            val_metrics = evaluate(model, val_loader, device)
            row.update({f"val_{k}": v for k, v in val_metrics.items()})
            print(
                f"  Epoch {epoch}/{args.epochs}  "
                f"train_loss={train_loss:.4f}  "
                f"val_loss={val_metrics['loss']:.4f}  "
                f"val_acc={val_metrics['accuracy']:.4f}  "
                f"val_f1={val_metrics['f1']:.4f}"
            )
            if val_metrics["f1"] > best_f1:
                best_f1 = val_metrics["f1"]
        else:
            print(f"  Epoch {epoch}/{args.epochs}  train_loss={train_loss:.4f}")

        history.append(row)

    print("-" * 60)

    # ── Save model ───────────────────────────────────────────────────────
    out = args.output_dir
    Path(out).mkdir(parents=True, exist_ok=True)

    print(f"\nSaving model to {out}/ ...")
    model.save_pretrained(out)
    tokenizer.save_pretrained(out)

    # Save label mapping
    label_map = {idx: label for idx, label in enumerate(INTENT_LABELS)}
    with open(os.path.join(out, "label_map.json"), "w") as f:
        json.dump(label_map, f, indent=2)

    # Save training history
    with open(os.path.join(out, "training_history.json"), "w") as f:
        json.dump(history, f, indent=2)

    # ── Final report ─────────────────────────────────────────────────────
    if val_loader:
        final = evaluate(model, val_loader, device)
        print(f"\nFinal Validation  acc={final['accuracy']:.4f}  f1={final['f1']:.4f}")

        # Detailed per-class report
        model.eval()
        preds, labels = [], []
        with torch.no_grad():
            for batch in val_loader:
                out_logits = model(
                    batch["input_ids"].to(device),
                    batch["attention_mask"].to(device),
                ).logits
                preds.extend(torch.argmax(out_logits, dim=-1).cpu().tolist())
                labels.extend(batch["labels"].tolist())

        print("\nPer-class report:")
        print(
            classification_report(
                labels,
                preds,
                target_names=INTENT_LABELS,
                zero_division=0,
            )
        )

    print("Done.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
