"""
anomaly_utils.py

Reusable anomaly / fraud detection logic for Honey Chain hive & harvest
records. Combines two layers, same pattern as ml_utils.py:

1. RULE-BASED CHECKS - fast, explainable, catch clearly impossible or
   physically implausible values even if the ML model hasn't seen anything
   quite like them before.
2. ISOLATION FOREST - a general-purpose ML anomaly detector that catches
   unusual COMBINATIONS of otherwise-valid-looking values that no single
   rule would flag on its own.

detect_anomaly() merges both into one structured result:
{
    "is_anomaly": bool,
    "anomaly_score": float (0.0 - 1.0, higher = more anomalous),
    "risk_level": "low" | "medium" | "high",
    "reason": str
}
"""

from pathlib import Path
import joblib
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "anomaly_detection_model.pkl"
SCALER_PATH = BASE_DIR / "models" / "anomaly_scaler.pkl"
METADATA_PATH = BASE_DIR / "models" / "anomaly_metadata.pkl"

anomaly_model = joblib.load(MODEL_PATH)
anomaly_scaler = joblib.load(SCALER_PATH)
anomaly_metadata = joblib.load(METADATA_PATH)

FEATURE_COLUMNS = anomaly_metadata["feature_columns"]
SCORE_MIN = anomaly_metadata["score_min"]
SCORE_MAX = anomaly_metadata["score_max"]

# -----------------------------------------------------------------------
# RULE-BASED THRESHOLDS
# Each threshold below is explained in a comment - these are not arbitrary.
# -----------------------------------------------------------------------

# Realistic hive temperature range. Below/above this, either the sensor is
# faulty or the reading has been fabricated - a hive interior outside this
# range would not have living, functioning bees.
TEMP_MIN, TEMP_MAX = 0.0, 50.0

# Humidity sensors reading a flat 0% or 100% for an outdoor/hive environment
# almost always indicate a sensor fault or a placeholder/fabricated value
# rather than a genuine reading.
HUMIDITY_SUSPICIOUS_LOW, HUMIDITY_SUSPICIOUS_HIGH = 2.0, 99.0

# A healthy hive's weight does not swing by several kg in a single day
# under normal foraging/consumption. Swings this large usually mean either
# a scale fault, hive tampering, or a data-entry error.
MAX_REALISTIC_WEIGHT_CHANGE = 3.0  # kg/day

# A single harvest cannot reasonably exceed roughly 70% of the hive's own
# total weight (bees + comb + structure + stores) - claiming more strongly
# suggests over-reporting/fraud or a measurement error.
MAX_HARVEST_TO_WEIGHT_RATIO = 0.7

# A large harvest reported alongside very poor flowering conditions is
# inconsistent - nectar flow (and therefore yield) depends heavily on
# available bloom.
LOW_FLOWERING_THRESHOLD = 0.15
HIGH_YIELD_DURING_LOW_FLOWERING = 15.0  # kg

# Heavy rain keeps bees from foraging; a high yield reported during very
# heavy rainfall is inconsistent with normal hive behaviour.
HEAVY_RAINFALL_THRESHOLD = 200.0  # mm
HIGH_YIELD_DURING_HEAVY_RAIN = 15.0  # kg


def _run_rule_checks(data: dict) -> list[str]:
    """Return a list of human-readable reasons for every rule that fires."""
    reasons = []

    if not (TEMP_MIN <= data["temperature"] <= TEMP_MAX):
        reasons.append(
            f"Temperature {data['temperature']}°C is outside the physically "
            f"plausible range ({TEMP_MIN}-{TEMP_MAX}°C) - likely a sensor fault."
        )

    if data["humidity"] <= HUMIDITY_SUSPICIOUS_LOW or data["humidity"] >= HUMIDITY_SUSPICIOUS_HIGH:
        reasons.append(
            f"Humidity {data['humidity']}% is an extreme/flat value typical of a faulty sensor."
        )

    if abs(data["weight_change"]) > MAX_REALISTIC_WEIGHT_CHANGE:
        reasons.append(
            f"Weight change of {data['weight_change']} kg/day is unrealistically large "
            f"for natural hive behaviour."
        )

    if data["hive_weight"] > 0 and data["honey_yield"] > MAX_HARVEST_TO_WEIGHT_RATIO * data["hive_weight"]:
        reasons.append(
            "Harvest quantity is unusually high relative to hive weight."
        )

    if data["flowering_index"] < LOW_FLOWERING_THRESHOLD and data["honey_yield"] > HIGH_YIELD_DURING_LOW_FLOWERING:
        reasons.append(
            "Reported honey yield is high despite very poor flowering/foraging conditions."
        )

    if data["rainfall"] > HEAVY_RAINFALL_THRESHOLD and data["honey_yield"] > HIGH_YIELD_DURING_HEAVY_RAIN:
        reasons.append(
            "Reported honey yield is high despite very heavy rainfall, which normally limits foraging."
        )

    return reasons


def _model_anomaly_score(data: dict) -> tuple[float, bool]:
    """
    Run IsolationForest and return (anomaly_score 0-1, model_flagged_anomaly).
    Raw score_samples() output is rescaled using the min/max seen during
    training so the returned score is intuitive: ~0 = very normal,
    ~1 = very anomalous.
    """
    ordered_df = pd.DataFrame([[data[col] for col in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
    scaled = anomaly_scaler.transform(ordered_df)

    raw_score = anomaly_model.score_samples(scaled)[0]
    model_flagged = anomaly_model.predict(scaled)[0] == -1  # -1 = anomaly

    # Rescale: SCORE_MIN (most anomalous seen in training) -> 1.0
    #          SCORE_MAX (most normal seen in training)    -> 0.0
    span = SCORE_MAX - SCORE_MIN
    if span == 0:
        normalized = 0.0
    else:
        normalized = (SCORE_MAX - raw_score) / span

    normalized = float(np.clip(normalized, 0.0, 1.0))
    return normalized, bool(model_flagged)


def _classify_risk(anomaly_score: float, rule_hits: list[str]) -> str:
    """
    Combine the model's continuous score with rule hits into a simple
    low/medium/high risk label:
      - Any rule hit on a clearly impossible value (temperature/humidity)
        is escalated straight to "high", regardless of model score, since
        these indicate sensor faults or fabricated data with high confidence.
      - Otherwise, risk follows the model's anomaly_score.
    """
    critical_keywords = ["sensor fault", "physically plausible"]
    if any(any(kw in reason for kw in critical_keywords) for reason in rule_hits):
        return "high"

    if anomaly_score >= 0.7 or len(rule_hits) >= 2:
        return "high"
    if anomaly_score >= 0.4 or len(rule_hits) == 1:
        return "medium"
    return "low"


def detect_anomaly(
    temperature: float,
    humidity: float,
    hive_weight: float,
    weight_change: float,
    honey_yield: float,
    rainfall: float,
    flowering_index: float,
    previous_yield: float,
) -> dict:
    """
    Run rule-based checks + IsolationForest on one hive/harvest record and
    return a structured anomaly assessment.
    """
    data = {
        "temperature": temperature,
        "humidity": humidity,
        "hive_weight": hive_weight,
        "weight_change": weight_change,
        "honey_yield": honey_yield,
        "rainfall": rainfall,
        "flowering_index": flowering_index,
        "previous_yield": previous_yield,
    }

    rule_hits = _run_rule_checks(data)
    anomaly_score, model_flagged = _model_anomaly_score(data)

    is_anomaly = model_flagged or len(rule_hits) > 0
    risk_level = _classify_risk(anomaly_score, rule_hits)

    if rule_hits:
        reason = " ".join(rule_hits)
    elif model_flagged:
        reason = (
            "No single rule was violated, but the overall combination of values "
            "is statistically unusual compared to typical hive/harvest records."
        )
    else:
        reason = "No significant anomaly detected."

    return {
        "is_anomaly": bool(is_anomaly),
        "anomaly_score": round(anomaly_score, 2),
        "risk_level": risk_level,
        "reason": reason,
    }