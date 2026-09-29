"""
generate_yield_dataset.py

⚠️ PROTOTYPE / SYNTHETIC DATA NOTICE ⚠️
-----------------------------------------
This script generates a SYNTHETIC dataset for the Honey Chain SIH prototype.
It does NOT contain real beekeeping data. The relationships between features
and yield are hand-designed to be "reasonably realistic" using domain
intuition (higher hive weight/weight gain/flowering -> more honey, extreme
weather -> less honey), plus random noise.

BEFORE PRODUCTION USE: Replace this with real field data collected from
actual hives (sensor logs + harvest records) and retrain the model.

Run:
    python generate_yield_dataset.py
"""

import os
import numpy as np
import pandas as pd

# -----------------------------
# Reproducibility
# -----------------------------
np.random.seed(42)

# -----------------------------
# Config
# -----------------------------
NUM_RECORDS = 3000
OUTPUT_DIR = "data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "honey_yield_data.csv")


def generate_dataset(n_records: int) -> pd.DataFrame:
    """
    Generate a synthetic honey yield dataset.

    Each row simulates a snapshot reading from a hive (temperature, humidity,
    weight, etc.) and a corresponding "future honey yield" produced from that
    hive over the following harvest period.
    """

    # --- 1. Temperature (Celsius) ---
    # Bees are most productive in a moderate range (~20-32°C).
    # We simulate a roughly normal distribution centered near 26°C.
    temperature = np.random.normal(loc=26, scale=6, size=n_records)
    temperature = np.clip(temperature, 5, 45)  # realistic bounds

    # --- 2. Humidity (%) ---
    humidity = np.random.normal(loc=55, scale=15, size=n_records)
    humidity = np.clip(humidity, 10, 100)

    # --- 3. Hive weight (kg) ---
    # Total weight of the hive box (bees + honey + structure).
    hive_weight = np.random.normal(loc=35, scale=8, size=n_records)
    hive_weight = np.clip(hive_weight, 10, 70)

    # --- 4. Weight change (kg/day) ---
    # Positive = hive gaining weight (good nectar flow), negative = losing.
    weight_change = np.random.normal(loc=0.15, scale=0.4, size=n_records)
    weight_change = np.clip(weight_change, -2, 2)

    # --- 5. Rainfall (mm) ---
    # Moderate rainfall supports flowering; too much rain hurts foraging.
    rainfall = np.random.exponential(scale=40, size=n_records)
    rainfall = np.clip(rainfall, 0, 300)

    # --- 6. Flowering index (0 to 1) ---
    # Represents how much bloom / nectar availability is around the hive.
    flowering_index = np.random.beta(a=2, b=2, size=n_records)  # bell-ish, bounded 0-1

    # --- 7. Previous yield (kg) ---
    # Last season/harvest's yield for this hive (colonies tend to be consistent).
    previous_yield = np.random.normal(loc=18, scale=6, size=n_records)
    previous_yield = np.clip(previous_yield, 0, 45)

    # -----------------------------------------------------
    # Build the target: predicted_honey_yield_kg
    # -----------------------------------------------------
    # Start from a base influenced by hive weight and previous yield
    base_yield = (0.35 * hive_weight) + (0.45 * previous_yield)

    # Positive weight change strongly boosts yield (active nectar flow)
    weight_change_effect = weight_change * 12

    # Flowering index has a strong positive effect
    flowering_effect = flowering_index * 15

    # Temperature effect: penalty for being far from ideal (~26°C)
    temp_deviation = np.abs(temperature - 26)
    temperature_effect = -0.25 * temp_deviation

    # Humidity effect: penalty for being far from ideal (~55%)
    humidity_deviation = np.abs(humidity - 55)
    humidity_effect = -0.05 * humidity_deviation

    # Rainfall effect: light rain helps flowers, heavy rain hurts foraging
    # Peaks around 50mm, penalizes extremes
    rainfall_effect = -0.0015 * (rainfall - 50) ** 2 / 10

    # Combine all effects
    raw_yield = (
        base_yield
        + weight_change_effect
        + flowering_effect
        + temperature_effect
        + humidity_effect
        + rainfall_effect
    )

    # Add realistic random noise so the model can't just "solve the formula"
    noise = np.random.normal(loc=0, scale=3.5, size=n_records)
    predicted_honey_yield_kg = raw_yield + noise

    # Yield cannot be negative in real life
    predicted_honey_yield_kg = np.clip(predicted_honey_yield_kg, 0, None)

    # Round for readability
    predicted_honey_yield_kg = np.round(predicted_honey_yield_kg, 2)

    # -----------------------------------------------------
    # Assemble DataFrame
    # -----------------------------------------------------
    df = pd.DataFrame({
        "temperature": np.round(temperature, 2),
        "humidity": np.round(humidity, 2),
        "hive_weight": np.round(hive_weight, 2),
        "weight_change": np.round(weight_change, 3),
        "rainfall": np.round(rainfall, 2),
        "flowering_index": np.round(flowering_index, 3),
        "previous_yield": np.round(previous_yield, 2),
        "predicted_honey_yield_kg": predicted_honey_yield_kg,
    })

    return df


def main():
    print("Generating synthetic honey yield dataset...")
    df = generate_dataset(NUM_RECORDS)

    # Ensure output directory exists (works regardless of where script is run from,
    # as long as it's run from the project root)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    df.to_csv(OUTPUT_FILE, index=False)

    print(f"✅ Dataset generated with {len(df)} records.")
    print(f"✅ Saved to: {OUTPUT_FILE}")
    print("\nSample rows:")
    print(df.head())
    print("\n⚠️  Reminder: This is SYNTHETIC prototype data for SIH demo purposes only.")
    print("   Replace with real field data before production use.")


if __name__ == "__main__":
    main()