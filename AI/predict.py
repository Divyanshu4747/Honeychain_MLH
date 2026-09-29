"""
predict.py
----------
Loads the trained model (models/hive_health_model.pkl) and lets you type in
sensor values by hand to get a predicted hive health status, along with the
model's confidence (probability) for each class.

Run this file with:
    python predict.py

Make sure you have already run:
    python generate_dataset.py
    python train_model.py
so that models/hive_health_model.pkl exists.
"""

import os
import joblib
import pandas as pd

MODEL_PATH = os.path.join("models", "hive_health_model.pkl")
FEATURE_COLUMNS = ["temperature", "humidity", "hive_weight", "weight_change"]


def load_model():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Could not find {MODEL_PATH}. "
            "Run 'python train_model.py' first to train and save the model."
        )
    return joblib.load(MODEL_PATH)


def ask_float(prompt_text):
    """
    Keeps asking the user for a number until they type a valid one.
    This prevents the script from crashing on bad input (e.g. typing 'abc').
    """
    while True:
        raw_value = input(prompt_text)
        try:
            return float(raw_value)
        except ValueError:
            print("  -> Please enter a valid number (e.g. 34.5). Try again.")


def get_sensor_input():
    """Prompts the user for the 4 sensor readings."""
    print("\nEnter the current hive sensor readings:")
    temperature = ask_float("  Temperature (Celsius): ")
    humidity = ask_float("  Humidity (%): ")
    hive_weight = ask_float("  Hive weight (kg): ")
    weight_change = ask_float("  Daily weight change (kg, negative if lost weight): ")
    return temperature, humidity, hive_weight, weight_change


def predict_health(model, temperature, humidity, hive_weight, weight_change):
    """
    Runs one prediction. We build a small DataFrame with the SAME column
    names/order used during training, because scikit-learn expects that.
    """
    input_df = pd.DataFrame(
        [[temperature, humidity, hive_weight, weight_change]],
        columns=FEATURE_COLUMNS
    )

    predicted_label = model.predict(input_df)[0]
    probabilities = model.predict_proba(input_df)[0]

    # Pair each class name with its predicted probability
    class_probabilities = dict(zip(model.classes_, probabilities))

    return predicted_label, class_probabilities


def print_result(predicted_label, class_probabilities):
    print("\n===== PREDICTION RESULT =====")
    print(f"Predicted health status: {predicted_label.upper()}")
    print("\nClass probabilities:")
    # Sort so the most likely class is shown first
    for label, prob in sorted(class_probabilities.items(), key=lambda x: x[1], reverse=True):
        print(f"  {label:10s}: {prob * 100:5.1f}%")


def main():
    model = load_model()
    print("Hive health model loaded successfully.")

    while True:
        temperature, humidity, hive_weight, weight_change = get_sensor_input()
        predicted_label, class_probabilities = predict_health(
            model, temperature, humidity, hive_weight, weight_change
        )
        print_result(predicted_label, class_probabilities)

        again = input("\nCheck another reading? (y/n): ").strip().lower()
        if again != "y":
            print("Goodbye!")
            break


if __name__ == "__main__":
    main()
