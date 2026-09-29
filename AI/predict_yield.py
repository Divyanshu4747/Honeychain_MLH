"""
predict_yield.py

Loads the trained honey yield model and lets the user manually enter
hive/environment values to get a predicted honey yield (kg).

Run:
    python predict_yield.py
"""

import os
import joblib
import pandas as pd

MODEL_PATH = os.path.join("models", "honey_yield_model.pkl")

FEATURE_COLUMNS = [
    "temperature",
    "humidity",
    "hive_weight",
    "weight_change",
    "rainfall",
    "flowering_index",
    "previous_yield",
]


def load_model():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model not found at '{MODEL_PATH}'. "
            f"Run 'python train_yield_model.py' first."
        )
    return joblib.load(MODEL_PATH)


def get_float_input(prompt: str) -> float:
    """Keep asking until the user enters a valid number."""
    while True:
        try:
            return float(input(prompt))
        except ValueError:
            print("⚠️  Please enter a valid number.")


def predict_yield(model, input_dict: dict) -> float:
    """
    Given a dict of the 7 required features, return a clamped,
    rounded honey yield prediction in kg.
    """
    # Build a single-row DataFrame with columns in the correct order
    input_df = pd.DataFrame([input_dict], columns=FEATURE_COLUMNS)

    prediction = model.predict(input_df)[0]

    # Honey yield cannot be negative in real life — clamp to zero
    prediction = max(0.0, prediction)

    # Round to 2 decimal places (sensible precision for kg)
    return round(prediction, 2)


def main():
    print("🐝 Honey Chain - Honey Yield Prediction 🍯")
    print("Enter the following hive/environment readings:\n")

    model = load_model()

    input_dict = {
        "temperature": get_float_input("Temperature (°C): "),
        "humidity": get_float_input("Humidity (%): "),
        "hive_weight": get_float_input("Hive weight (kg): "),
        "weight_change": get_float_input("Weight change (kg/day): "),
        "rainfall": get_float_input("Rainfall (mm): "),
        "flowering_index": get_float_input("Flowering index (0 to 1): "),
        "previous_yield": get_float_input("Previous yield (kg): "),
    }

    result = predict_yield(model, input_dict)

    print("\n----------------------------------")
    print(f"🍯 Predicted Honey Yield: {result} kg")
    print("----------------------------------")


if __name__ == "__main__":
    main()