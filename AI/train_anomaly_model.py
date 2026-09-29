"""
train_anomaly_model.py

Trains an IsolationForest on the synthetic anomaly dataset and saves both
the model and the feature scaler (needed at prediction time) to disk.

IsolationForest is UNSUPERVISED - it is trained only on the feature
columns, never on the is_anomaly label. The label is used afterwards
purely to sanity-check how well the model separates normal vs anomalous
records on this synthetic set.

Run:
    python train_anomaly_model.py
"""

import os
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report

DATA_PATH = os.path.join("data", "anomaly_training_data.csv")
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "anomaly_detection_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "anomaly_scaler.pkl")
METADATA_PATH = os.path.join(MODEL_DIR, "anomaly_metadata.pkl")

FEATURE_COLUMNS = [
    "temperature",
    "humidity",
    "hive_weight",
    "weight_change",
    "honey_yield",
    "rainfall",
    "flowering_index",
    "previous_yield",
]

# Expected proportion of anomalous records in real-world data.
# This must match how the synthetic dataset was generated (~5%).
CONTAMINATION = 0.05
RANDOM_STATE = 42


def main():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(
            f"Dataset not found at '{DATA_PATH}'. Run 'python generate_anomaly_dataset.py' first."
        )

    print(f"Loading dataset from {DATA_PATH} ...")
    df = pd.read_csv(DATA_PATH)

    X = df[FEATURE_COLUMNS]
    y_true = df["is_anomaly"]  # only used for evaluation, NOT for training

    # Scale features so no single feature (e.g. rainfall's large range)
    # dominates the distance-based isolation splits.
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print("Training IsolationForest...")
    model = IsolationForest(
        n_estimators=200,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    # -1 = anomaly, 1 = normal (sklearn convention) -> convert to 1/0
    raw_predictions = model.predict(X_scaled)
    predicted_anomaly = (raw_predictions == -1).astype(int)

    print("\n----- Evaluation vs synthetic labels (sanity check only) -----")
    print(classification_report(y_true, predicted_anomaly, target_names=["normal", "anomaly"]))
    print("-----------------------------------------------------------\n")

    # score_samples() gives raw isolation scores (lower = more anomalous),
    # but the raw range is narrow and not human-friendly. We record the
    # min/max seen on the training set so predict_anomaly() can rescale
    # any future raw score into an intuitive 0 (normal) - 1 (anomalous)
    # "anomaly_score" at prediction time.
    raw_scores = model.score_samples(X_scaled)
    metadata = {
        "feature_columns": FEATURE_COLUMNS,
        "score_min": float(raw_scores.min()),
        "score_max": float(raw_scores.max()),
        "contamination": CONTAMINATION,
    }

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    joblib.dump(metadata, METADATA_PATH)

    print(f"✅ Model saved to: {MODEL_PATH}")
    print(f"✅ Scaler saved to: {SCALER_PATH}")
    print(f"✅ Metadata saved to: {METADATA_PATH}")
    print(f"   (score_min={metadata['score_min']:.4f}, score_max={metadata['score_max']:.4f})")


if __name__ == "__main__":
    main()