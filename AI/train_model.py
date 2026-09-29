"""
train_model.py
---------------
Loads the synthetic hive dataset (data/hive_data.csv), trains a
RandomForestClassifier to predict hive health status, evaluates it,
and saves the trained model to models/hive_health_model.pkl.

Run this file with:
    python train_model.py

Make sure you have already run generate_dataset.py at least once so that
data/hive_data.csv exists.
"""

import os
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    classification_report,
    confusion_matrix,
)

# ---------------------------------------------------------------------------
# 1. LOAD THE DATASET
# ---------------------------------------------------------------------------

DATA_PATH = os.path.join("data", "hive_data.csv")

if not os.path.exists(DATA_PATH):
    raise FileNotFoundError(
        f"Could not find {DATA_PATH}. "
        "Run 'python generate_dataset.py' first to create the dataset."
    )

df = pd.read_csv(DATA_PATH)
print(f"Loaded {len(df)} rows from {DATA_PATH}")

# ---------------------------------------------------------------------------
# 2. BASIC PREPROCESSING
# ---------------------------------------------------------------------------
# Our features are already numeric (temperature, humidity, weight, weight
# change), so there is no need to encode them. The only thing we need to
# handle is the target column, which is text (healthy/warning/critical).
#
# We keep the target as text for now and let scikit-learn's classifier work
# with it directly -- RandomForestClassifier can handle string class labels
# without any extra encoding. This keeps the code simple for a beginner.

FEATURE_COLUMNS = ["temperature", "humidity", "hive_weight", "weight_change"]
TARGET_COLUMN = "health_status"

# Drop any rows with missing values, just in case (good practice with real
# sensor data, which can have gaps/dropouts).
df = df.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN])

X = df[FEATURE_COLUMNS]
y = df[TARGET_COLUMN]

# ---------------------------------------------------------------------------
# 3. TRAIN / TEST SPLIT
# ---------------------------------------------------------------------------
# We hold out 20% of the data to test the model on data it has never seen.
# stratify=y keeps the same class proportions in both train and test sets.

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

print(f"Training rows: {len(X_train)} | Testing rows: {len(X_test)}")

# ---------------------------------------------------------------------------
# 4. TRAIN THE MODEL
# ---------------------------------------------------------------------------
# RandomForestClassifier builds many decision trees and combines their votes.
# It's a strong, easy-to-use default for tabular sensor data like this.

model = RandomForestClassifier(
    n_estimators=200,     # number of trees in the forest
    max_depth=10,         # limit tree depth to reduce overfitting
    random_state=42,
    class_weight="balanced"  # helps because "critical" is the rarest class
)

model.fit(X_train, y_train)

# ---------------------------------------------------------------------------
# 5. EVALUATE THE MODEL
# ---------------------------------------------------------------------------

y_pred = model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)
# average="macro" treats all 3 classes equally, even though "critical" is rarer
precision = precision_score(y_test, y_pred, average="macro")
recall = recall_score(y_test, y_pred, average="macro")

print("\n===== MODEL EVALUATION =====")
print(f"Accuracy:  {accuracy:.4f}")
print(f"Precision (macro avg): {precision:.4f}")
print(f"Recall (macro avg):    {recall:.4f}")

print("\nFull classification report (per class):")
print(classification_report(y_test, y_pred))

print("Confusion matrix (rows = actual, columns = predicted):")
print("Class order:", model.classes_)
print(confusion_matrix(y_test, y_pred, labels=model.classes_))

# Which sensor features matter most to the model? Useful to sanity-check
# that the model learned something sensible (e.g. weight_change should
# matter a lot, matching real beekeeping knowledge).
print("\nFeature importances:")
for feature, importance in sorted(
    zip(FEATURE_COLUMNS, model.feature_importances_),
    key=lambda pair: pair[1],
    reverse=True
):
    print(f"  {feature}: {importance:.4f}")

# ---------------------------------------------------------------------------
# 6. SAVE THE TRAINED MODEL
# ---------------------------------------------------------------------------

os.makedirs("models", exist_ok=True)
MODEL_PATH = os.path.join("models", "hive_health_model.pkl")

joblib.dump(model, MODEL_PATH)
print(f"\nSaved trained model to: {MODEL_PATH}")
