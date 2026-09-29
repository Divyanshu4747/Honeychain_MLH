"""
ml_utils.py

Reusable ML prediction functions. These are the SINGLE SOURCE OF TRUTH
for running the hive-health and honey-yield models, used by:
- the REST endpoints (/predict/hive-health, /predict/yield)
- BeeSaathi's chatbot tools (get_hive_health, get_honey_yield)

Keeping the logic here (instead of duplicating it, or having the chatbot
call the API over HTTP) guarantees identical predictions everywhere.
"""

from pathlib import Path
import joblib

# Project root = folder containing the "app" directory
BASE_DIR = Path(__file__).resolve().parent.parent

HIVE_HEALTH_MODEL_PATH = BASE_DIR / "models" / "hive_health_model.pkl"
HONEY_YIELD_MODEL_PATH = BASE_DIR / "models" / "honey_yield_model.pkl"

# Load both trained models once, at import time
hive_health_model = joblib.load(HIVE_HEALTH_MODEL_PATH)
honey_yield_model = joblib.load(HONEY_YIELD_MODEL_PATH)


def predict_hive_health(
    temperature: float,
    humidity: float,
    hive_weight: float,
    weight_change: float,
) -> dict:
    """Run the hive-health classifier and return status + class probabilities."""
    input_data = [[temperature, humidity, hive_weight, weight_change]]

    prediction = hive_health_model.predict(input_data)[0]
    probabilities = hive_health_model.predict_proba(input_data)[0]
    class_names = hive_health_model.classes_

    probability_result = {
        str(class_name): round(float(probability), 4)
        for class_name, probability in zip(class_names, probabilities)
    }

    return {
        "health_status": str(prediction),
        "probabilities": probability_result,
    }


def predict_honey_yield(
    temperature: float,
    humidity: float,
    hive_weight: float,
    weight_change: float,
    rainfall: float,
    flowering_index: float,
    previous_yield: float,
) -> dict:
    """Run the honey-yield regressor. Feature order MUST match training order."""
    input_data = [[
        temperature,
        humidity,
        hive_weight,
        weight_change,
        rainfall,
        flowering_index,
        previous_yield,
    ]]

    prediction = honey_yield_model.predict(input_data)[0]

    # Honey yield can never be negative in real life
    prediction = max(0.0, float(prediction))

    return {"predicted_honey_yield_kg": round(prediction, 2)}