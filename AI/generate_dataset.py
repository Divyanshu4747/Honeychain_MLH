"""
generate_dataset.py
--------------------
Generates a SYNTHETIC (fake but realistic-looking) dataset of beehive sensor
readings for the Honey Chain "Hive Health Detection" MVP.

WHY SYNTHETIC DATA?
Real hive sensors are not available yet, so we simulate readings using
knowledge of how real beehives behave:

- A healthy hive keeps its INTERNAL brood-nest temperature tightly
  regulated around ~34-35 degrees C, almost regardless of outside weather.
  Bees fan their wings to cool the hive or cluster together to warm it.
  Big deviations from ~34.5C usually mean something is wrong (queen
  loss, disease, ventilation failure, etc).

- Healthy humidity inside the hive is usually around 50-65%.
  Too dry can stress brood; too humid encourages mold/disease.

- Hive weight (total kg of hive + bees + honey stores) varies a lot
  between hives (a small nucleus colony vs a huge established one),
  so by itself it isn't a perfect health signal. But a very LOW total
  weight often means a weak/small colony.

- Daily weight CHANGE is one of the most useful signals in real
  beekeeping. A steady small gain = bees foraging & storing honey
  (good). A sudden big drop can mean swarming, robbing by other
  hives/wasps, or starvation. A tiny loss (a few bees dying naturally,
  water evaporating from nectar) is normal.

HOW THE LABELS ARE CREATED (not pure randomness):
We do NOT just assign healthy/warning/critical randomly. Instead we:
  1. Randomly sample each sensor value from a realistic distribution.
  2. Compute a numeric "risk score" from how far each sensor value is
     from what a healthy hive normally looks like (see compute_risk_score).
  3. Add a small amount of random noise to the score (real life is noisy
     and measurements are never perfect).
  4. Convert the final score into a label using thresholds:
        low score      -> healthy
        medium score    -> warning
        high score     -> critical

This keeps the relationship between sensors and labels realistic and
learnable by a machine learning model, while still having natural
overlap/noise between classes (like real data would).

Run this file with:
    python generate_dataset.py
It will create: data/hive_data.csv
"""

import os
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# 1. SETTINGS
# ---------------------------------------------------------------------------

NUM_RECORDS = 5000          # how many synthetic hive readings to generate
RANDOM_SEED = 42            # fixed seed -> same "random" data every run (reproducible)

# Ideal ("healthy") reference values for a beehive, based on real beekeeping knowledge
IDEAL_TEMP_C = 34.5         # ideal brood nest temperature in Celsius
IDEAL_HUMIDITY_PCT = 55.0   # ideal internal humidity percentage
MIN_HEALTHY_WEIGHT_KG = 20  # below this, a colony is considered small/weak

np.random.seed(RANDOM_SEED)


# ---------------------------------------------------------------------------
# 2. FUNCTIONS TO GENERATE RAW SENSOR VALUES
# ---------------------------------------------------------------------------

def generate_temperature(n):
    """
    Most hives sit close to the ideal temperature (bees regulate it well).
    Occasionally (fewer records) we simulate a hive under stress, which can
    swing much colder or hotter than normal.
    """
    # 85% of readings: close to ideal, small natural fluctuation
    normal = np.random.normal(loc=IDEAL_TEMP_C, scale=1.2, size=n)
    # 15% of readings: hive under stress -> wider, more extreme fluctuation
    stressed = np.random.normal(loc=IDEAL_TEMP_C, scale=5.0, size=n)

    mask_stressed = np.random.rand(n) < 0.15
    temp = np.where(mask_stressed, stressed, normal)

    # Clip to a physically reasonable sensor range
    return np.clip(temp, 15, 45)


def generate_humidity(n):
    """
    Similar idea: most readings cluster near the ideal humidity band,
    a minority show more extreme (too dry / too damp) conditions.
    """
    normal = np.random.normal(loc=IDEAL_HUMIDITY_PCT, scale=6.0, size=n)
    stressed = np.random.normal(loc=IDEAL_HUMIDITY_PCT, scale=18.0, size=n)

    mask_stressed = np.random.rand(n) < 0.15
    humidity = np.where(mask_stressed, stressed, normal)

    return np.clip(humidity, 10, 95)


def generate_hive_weight(n):
    """
    Total hive weight (kg) varies a lot depending on colony size/season.
    We model it as a mix of small/weak colonies and larger established ones.
    """
    small_colony = np.random.normal(loc=15, scale=4, size=n)     # weak/young colony
    large_colony = np.random.normal(loc=45, scale=10, size=n)    # strong/established colony

    mask_small = np.random.rand(n) < 0.25
    weight = np.where(mask_small, small_colony, large_colony)

    return np.clip(weight, 5, 90)


def generate_weight_change(n):
    """
    Daily weight change in kg.
    Healthy hives typically show a small, slightly positive or near-zero
    change (bees bringing in nectar). Problem hives can show sudden big
    drops (robbing, swarming, starvation) or occasionally unusual spikes.
    """
    normal_change = np.random.normal(loc=0.15, scale=0.4, size=n)   # small daily gain, minor noise
    big_drop = np.random.normal(loc=-2.5, scale=1.0, size=n)        # swarming / robbing / collapse

    mask_drop = np.random.rand(n) < 0.12
    change = np.where(mask_drop, big_drop, normal_change)

    return np.clip(change, -6, 4)


# ---------------------------------------------------------------------------
# 3. RISK SCORE -> HEALTH LABEL
# ---------------------------------------------------------------------------

def compute_risk_score(temp, humidity, weight, weight_change):
    """
    Turns raw sensor readings into a single numeric "risk score".
    Higher score = less healthy hive.

    The weights (multipliers) below reflect how important each factor is,
    based on beekeeping domain knowledge:
      - Temperature swings matter a lot (bees work hard to avoid them).
      - Sudden weight LOSS matters a lot (usually a serious event).
      - Humidity swings matter moderately.
      - Very low total weight (weak colony) adds some risk.
    """
    score = np.zeros_like(temp, dtype=float)

    # --- Temperature contribution ---
    temp_deviation = np.abs(temp - IDEAL_TEMP_C)
    score += temp_deviation * 1.8

    # --- Humidity contribution ---
    humidity_deviation = np.abs(humidity - IDEAL_HUMIDITY_PCT)
    score += humidity_deviation * 0.35

    # --- Weight change contribution ---
    # Losing weight is much worse than gaining weight.
    weight_loss_penalty = np.where(weight_change < 0, np.abs(weight_change) * 6.0, 0)
    weight_gain_penalty = np.where(weight_change > 0, weight_change * 0.8, 0)  # unusually big gains: mild penalty
    score += weight_loss_penalty + weight_gain_penalty

    # --- Low absolute weight contribution (weak colony) ---
    low_weight_penalty = np.where(weight < MIN_HEALTHY_WEIGHT_KG,
                                   (MIN_HEALTHY_WEIGHT_KG - weight) * 0.6, 0)
    score += low_weight_penalty

    # --- Random noise (real-world measurement/behavioural noise) ---
    noise = np.random.normal(loc=0, scale=2.5, size=len(temp))
    score += noise

    return score


def score_to_label(score):
    """
    Converts the numeric risk score into 3 categories using thresholds.
    Thresholds were chosen (and manually tuned) so the dataset ends up with
    a reasonable, realistic class balance instead of one class dominating.
    """
    labels = np.where(
        score < 6, "healthy",
        np.where(score < 14, "warning", "critical")
    )
    return labels


# ---------------------------------------------------------------------------
# 4. MAIN: GENERATE THE FULL DATASET
# ---------------------------------------------------------------------------

def generate_dataset(n=NUM_RECORDS):
    temperature = generate_temperature(n)
    humidity = generate_humidity(n)
    hive_weight = generate_hive_weight(n)
    weight_change = generate_weight_change(n)

    risk_score = compute_risk_score(temperature, humidity, hive_weight, weight_change)
    health_status = score_to_label(risk_score)

    df = pd.DataFrame({
        "temperature": np.round(temperature, 2),
        "humidity": np.round(humidity, 2),
        "hive_weight": np.round(hive_weight, 2),
        "weight_change": np.round(weight_change, 2),
        "health_status": health_status
    })

    return df


if __name__ == "__main__":
    df = generate_dataset()

    # Make sure the data/ folder exists (works no matter where script is run from,
    # as long as you run it from the project root as instructed).
    os.makedirs("data", exist_ok=True)

    output_path = os.path.join("data", "hive_data.csv")
    df.to_csv(output_path, index=False)

    print(f"Generated {len(df)} synthetic hive records.")
    print("Class distribution:")
    print(df["health_status"].value_counts())
    print(f"\nSaved dataset to: {output_path}")
