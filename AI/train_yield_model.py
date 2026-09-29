"""
train_yield_model.py

Trains a RandomForestRegressor on the synthetic honey yield dataset
and saves the trained model to disk using joblib.

Run:
    python train_yield_model.py
"""

import os
import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# -----------------------------
# Config / Paths
# -----------------------------
DATA_PATH = os.path.join("data", "honey_yield_data.csv")
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "honey_yield_model.pkl")

FEATURE_COLUMNS = [
    "temperature",
    "humidity",
    "hive_weight",
    "weight_change",
    "rainfall",
    "flowering_index",
    "previous_yield",
]
TARGET_COLUMN = "predicted_honey_yield_kg"

RANDOM_STATE = 42
TEST_SIZE = 0.2


def main():
    # -----------------------------
    # 1. Load dataset
    # -----------------------------
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(
            f"Dataset not found at '{DATA_PATH}'. "
            f"Run 'python generate_yield_dataset.py' first."
        )

    print(f"Loading dataset from {DATA_PATH} ...")
    df = pd.read_csv(DATA_PATH)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    # -----------------------------
    # 2. Train/test split
    # -----------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    print(f"Training samples: {len(X_train)} | Testing samples: {len(X_test)}")

    # -----------------------------
    # 3. Train RandomForestRegressor
    # -----------------------------
    print("Training RandomForestRegressor...")
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=None,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    # -----------------------------
    # 4. Evaluate
    # -----------------------------
    y_pred = model.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print("\n----- Model Evaluation -----")
    print(f"MAE  (Mean Absolute Error):      {mae:.3f} kg")
    print(f"RMSE (Root Mean Squared Error):  {rmse:.3f} kg")
    print(f"R² Score:                        {r2:.3f}")
    print("-----------------------------\n")

    # -----------------------------
    # 5. Save model
    # -----------------------------
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"✅ Model saved to: {MODEL_PATH}")


if __name__ == "__main__":
    main()