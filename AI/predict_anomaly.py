"""
predict_anomaly.py

Standalone script to test the anomaly detection model with three built-in
example records (normal / suspicious / abnormal sensor values).

Run:
    python predict_anomaly.py
"""

from app.anomaly_utils import detect_anomaly


def print_result(label: str, record: dict):
    result = detect_anomaly(**record)
    print(f"\n--- {label} ---")
    print("Input :", record)
    print("Result:", result)


def main():
    normal_record = {
        "temperature": 26.5, "humidity": 58.0, "hive_weight": 35.0,
        "weight_change": 0.3, "honey_yield": 9.0, "rainfall": 25.0,
        "flowering_index": 0.65, "previous_yield": 8.5,
    }

    suspicious_record = {
        "temperature": 34.2, "humidity": 67.5, "hive_weight": 42.8,
        "weight_change": 1.2, "honey_yield": 38.5, "rainfall": 2.0,
        "flowering_index": 0.8, "previous_yield": 7.9,
    }

    abnormal_sensor_record = {
        "temperature": 58.0, "humidity": 100.0, "hive_weight": 40.0,
        "weight_change": 5.5, "honey_yield": 8.0, "rainfall": 10.0,
        "flowering_index": 0.5, "previous_yield": 9.0,
    }

    print_result("1. Normal record", normal_record)
    print_result("2. Suspicious record (harvest/weight ratio)", suspicious_record)
    print_result("3. Abnormal sensor values", abnormal_sensor_record)


if __name__ == "__main__":
    main()