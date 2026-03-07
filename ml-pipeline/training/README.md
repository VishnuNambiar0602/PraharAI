# ML Training Pipeline

End-to-end training scripts for PraharAI ML models.

## Quick Start

```bash
cd ml-pipeline

# 1. Generate synthetic training data
python training/data_extractor.py --source synthetic

# 2. Train user classifier (DBSCAN)
python scripts/train_user_classifier.py --output models/user_classifier.pkl

# 3. Train intent classifier (DistilBERT)
python training/intent_trainer.py

# 4. Train recommendation ranker
python training/recommendation_trainer.py

# 5. Evaluate all models
python training/evaluate.py --model all
```

## Scripts

### `data_extractor.py` — Training Data Pipeline

Extracts data from Neo4j or generates synthetic datasets.

```bash
# Synthetic data (default, no database needed)
python training/data_extractor.py --source synthetic --n-users 2000 --n-schemes 300

# From Neo4j database
python training/data_extractor.py \
  --source neo4j \
  --neo4j-uri bolt://localhost:7687 \
  --neo4j-user neo4j \
  --neo4j-password your-password
```

**Outputs** (`data/training/`):
| File | Description |
|------|-------------|
| `users.json` | User profiles |
| `schemes.json` | Scheme records with categories |
| `interactions.json` | User→scheme interaction signals |
| `intent_train.json` | Intent classification training data |
| `intent_val.json` | Intent classification validation data |
| `manifest.json` | Dataset metadata |

### `intent_trainer.py` — Intent Classifier

Fine-tunes DistilBERT for classifying user queries into 7 intent categories:
`scheme_search`, `eligibility_check`, `application_info`, `deadline_query`,
`profile_update`, `general_question`, `nudge_preferences`.

```bash
python training/intent_trainer.py \
  --train-data data/training/intent_train.json \
  --val-data data/training/intent_val.json \
  --epochs 5 \
  --batch-size 16 \
  --lr 2e-5 \
  --output-dir models/intent_classifier
```

**Outputs** (`models/intent_classifier/`):

- `pytorch_model.bin` / `model.safetensors` — trained weights
- `config.json` — model config
- `tokenizer.json` — tokenizer
- `label_map.json` — intent label mapping
- `training_history.json` — per-epoch metrics

### `recommendation_trainer.py` — Recommendation Ranker

Trains an XGBoost LambdaMART model for scheme ranking. Falls back to
heuristic linear weights if XGBoost is not installed.

```bash
python training/recommendation_trainer.py \
  --users data/training/users.json \
  --schemes data/training/schemes.json \
  --interactions data/training/interactions.json \
  --n-estimators 100 \
  --max-depth 6
```

**Outputs** (`models/`):

- `recommendation_ranker.xgb` (XGBoost) or `recommendation_weights.json` (heuristic)
- `recommendation_metrics.json`

### `evaluate.py` — Model Evaluation

Evaluates one or all trained models.

```bash
# Evaluate all models
python training/evaluate.py --model all

# Evaluate just intent
python training/evaluate.py --model intent

# Custom paths
python training/evaluate.py \
  --model recommendation \
  --rec-model models/recommendation_ranker.xgb \
  --output models/evaluation_report.json
```

**Metrics**:
| Model | Key Metrics |
|-------|------------|
| Intent Classifier | Accuracy, F1, per-class precision/recall |
| User Classifier | Silhouette score, cluster count, noise ratio |
| Recommendation | NDCG@5, NDCG@10 |

## Full Pipeline

Run everything in order:

```bash
# Step 1: Generate data
python training/data_extractor.py --source synthetic

# Step 2: Train user classifier
python scripts/train_user_classifier.py \
  --input data/training/users.json \
  --output models/user_classifier.pkl

# Step 3: Train intent classifier
python training/intent_trainer.py

# Step 4: Train recommendation ranker
python training/recommendation_trainer.py

# Step 5: Evaluate
python training/evaluate.py --model all --output models/evaluation_report.json

# Step 6: Start the ML service (uses trained models)
python -m uvicorn src.main:app --port 8000
```

## Architecture

```
training/
├── __init__.py                 # Package init
├── data_extractor.py           # Neo4j extraction + synthetic generation
├── intent_trainer.py           # DistilBERT fine-tuning
├── recommendation_trainer.py   # XGBoost LTR / heuristic weights
├── evaluate.py                 # Unified evaluation
└── README.md                   # This file

data/training/                  # Generated training data (gitignored)
├── users.json
├── schemes.json
├── interactions.json
├── intent_train.json
├── intent_val.json
└── manifest.json

models/                         # Trained models
├── intent_classifier/          # DistilBERT checkpoint
├── user_classifier.pkl         # DBSCAN model
├── recommendation_ranker.xgb   # XGBoost ranker
└── evaluation_report.json      # Consolidated metrics
```
