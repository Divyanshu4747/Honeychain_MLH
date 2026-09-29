"""
generate_anomaly_dataset.py

⚠️ PROTOTYPE / SYNTHETIC DATA NOTICE ⚠️
-----------------------------------------
This generates a SYNTHETIC dataset for training the Honey Chain anomaly/
fraud detection model. There is no real fraud-labeled dataset available for
this SIH prototype, so normal records are simulated using the same
realistic ranges as the honey-yield dataset, and a smaller percentage of
anomalous records are injected on top using several distinct anomaly
patterns (impossible sensor values, harvest/weight inconsistency, etc).

Note: IsolationForest itself is trained UNSUPERVISED (it never sees the
"is_anomaly" label during training) - the label column here exists only so
WE can evaluate how well the trained model separates normal vs anomalous
records after the fact.

BEFORE PRODUCTION USE: Replace with real hive/harvest records (ideally
including some confirmed-fraud or confirmed-sensor-fault cases) and retrain.

Run:
    python generate_anomaly_dataset.py
"""

import os
import numpy as np
import pandas as pd

np.random.seed(42)

OUTPUT_DIR = "data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "anomaly_training_data.csv")

N_NORMAL = 2850
N_ANOMALY = 150  # ~5% anomalous records, a realistic contamination rate


def generate_normal_records(n):
    """Same realistic ranges used for the honey-yield dataset."""
    temperature = np.clip(np.random.normal(26, 6, n), 5, 45)
    humidity = np.clip(np.random.normal(55, 15, n), 10, 100)
    hive_weight = np.clip(np.random.normal(35, 8, n), 10, 70)
    weight_change = np.clip(np.random.normal(0.15, 0.4, n), -2, 2)
    rainfall = np.clip(np.random.exponential(40, n), 0, 300)
    flowering_index = np.random.beta(2, 2, n)
    previous_yield = np.clip(np.random.normal(18, 6, n), 0, 45)

    # Actual harvested honey - correlated with hive_weight, flowering_index,
    # and previous_yield, plus noise, but kept within a physically sane
    # proportion of hive_weight (a hive can't yield more honey than a
    # reasonable fraction of its own total weight in one harvest).
    base = 0.25 * hive_weight + 0.4 * previous_yield + 10 * flowering_index
    noise = np.random.normal(0, 2.5, n)
    honey_yield = np.clip(base + noise, 0, None)
    # Cap at a realistic proportion of hive weight (~60%) for normal records
    honey_yield = np.minimum(honey_yield, 0.6 * hive_weight)

    df = pd.DataFrame({
        "temperature": temperature,
        "humidity": humidity,
        "hive_weight": hive_weight,
        "weight_change": weight_change,
        "honey_yield": honey_yield,
        "rainfall": rainfall,
        "flowering_index": flowering_index,
        "previous_yield": previous_yield,
        "is_anomaly": 0,
    })
    return df


def generate_anomalous_records(n):
    """
    Inject several distinct, explainable anomaly patterns so the model
    learns a variety of "shapes" of suspicious records, not just one.
    """
    rows = []
    patterns = [
        "impossible_temperature",
        "impossible_humidity",
        "extreme_weight_swing",
        "harvest_exceeds_hive_weight_ratio",
        "yield_inconsistent_with_conditions",
        "extreme_rainfall_with_high_yield",
    ]

    for i in range(n):
        pattern = patterns[i % len(patterns)]

        # Start from a normal-ish baseline record, then corrupt one aspect
        temperature = np.clip(np.random.normal(26, 6), 5, 45)
        humidity = np.clip(np.random.normal(55, 15), 10, 100)
        hive_weight = np.clip(np.random.normal(35, 8), 10, 70)
        weight_change = np.clip(np.random.normal(0.15, 0.4), -2, 2)
        rainfall = np.clip(np.random.exponential(40), 0, 300)
        flowering_index = np.random.beta(2, 2)
        previous_yield = np.clip(np.random.normal(18, 6), 0, 45)
        honey_yield = 0.25 * hive_weight + 0.4 * previous_yield + 10 * flowering_index

        if pattern == "impossible_temperature":
            # Sensor fault or fabricated reading: absurd temperature
            temperature = np.random.choice([-15, 55, 60])

        elif pattern == "impossible_humidity":
            humidity = np.random.choice([0, 1, 100])  # edge/impossible extremes

        elif pattern == "extreme_weight_swing":
            # Real hives don't gain/lose multiple kg in a single day naturally
            weight_change = np.random.choice([-6, -5, 5, 6, 7])

        elif pattern == "harvest_exceeds_hive_weight_ratio":
            # Fraudulent over-reporting: harvest far exceeds what the hive
            # could physically have produced relative to its own weight
            honey_yield = hive_weight * np.random.uniform(0.9, 1.6)

        elif pattern == "yield_inconsistent_with_conditions":
            # High yield claimed despite very poor flowering/foraging conditions
            flowering_index = np.random.uniform(0.0, 0.1)
            honey_yield = np.random.uniform(25, 40)

        elif pattern == "extreme_rainfall_with_high_yield":
            # Very heavy rain (bees can't forage) but an implausibly high yield
            rainfall = np.random.uniform(250, 300)
            honey_yield = np.random.uniform(25, 35)

        honey_yield = max(0.0, honey_yield)

        rows.append({
            "temperature": temperature,
            "humidity": humidity,
            "hive_weight": hive_weight,
            "weight_change": weight_change,
            "honey_yield": honey_yield,
            "rainfall": rainfall,
            "flowering_index": flowering_index,
            "previous_yield": previous_yield,
            "is_anomaly": 1,
        })

    return pd.DataFrame(rows)


def main():
    print("Generating synthetic anomaly/fraud detection dataset...")
    normal_df = generate_normal_records(N_NORMAL)
    anomaly_df = generate_anomalous_records(N_ANOMALY)

    df = pd.concat([normal_df, anomaly_df], ignore_index=True)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)  # shuffle

    for col in ["temperature", "humidity", "hive_weight", "honey_yield", "rainfall", "previous_yield"]:
        df[col] = df[col].round(2)
    df["weight_change"] = df["weight_change"].round(3)
    df["flowering_index"] = df["flowering_index"].round(3)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df.to_csv(OUTPUT_FILE, index=False)

    print(f"✅ Dataset generated: {len(df)} records "
          f"({(df['is_anomaly']==0).sum()} normal, {(df['is_anomaly']==1).sum()} anomalous)")
    print(f"✅ Saved to: {OUTPUT_FILE}")
    print("\nSample rows:")
    print(df.head())
    print("\n⚠️  Reminder: This is SYNTHETIC prototype data. Replace with real")
    print("   hive/harvest records before production use.")


if __name__ == "__main__":
    main()