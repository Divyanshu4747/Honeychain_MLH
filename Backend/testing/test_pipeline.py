import requests

BASE_URL = "http://127.0.0.1:8000"
API_KEY = "sih2026_secret_cadastral_key_99"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

print("==================================================")
print("  HONEY CHAIN BACKEND TEST PIPELINE WITH ALERTS   ")
print("==================================================\n")

# --- Test Case 1: Standard Ingestion (Healthy Hive) ---
print("--- 1. Ingesting Normal Telemetry (Healthy Hive) ---")
normal_payload = {
    "hive_id": "HONEY-BLOCK-99",
    "temperature": 34.5,
    "humidity": 55.0,
    "weight": 12.4,
    "sound_frequency": 240.2,
    "ai_prediction": {
        "purity_score": "98.2%",
        "quality_grade": "A+",
        "authenticity": "Pure Organic Honey",
        "adulteration_flag": False
    }
}

res1 = requests.post(f"{BASE_URL}/telemetry", json=normal_payload, headers=headers)
print("Status Code:", res1.status_code)
print("Response:", res1.json())
print()


# --- Test Case 2: Abnormal Ingestion (Triggers Warning & SMS Alert) ---
print("--- 2. Ingesting Abnormal Telemetry (Triggers SMS Warning) ---")
abnormal_payload = {
    "hive_id": "HONEY-BLOCK-99",
    "temperature": 43.2,  # Temperature spike (>40°C)
    "humidity": 60.0,
    "weight": 25.0,        # Sudden unnatural weight increase
    "sound_frequency": 150.0,
    "ai_prediction": {
        "purity_score": "45.0%",
        "quality_grade": "Rejected",
        "authenticity": "Adulterated",
        "adulteration_flag": True  # Triggers Sugar Syrup Alert
    }
}

res2 = requests.post(f"{BASE_URL}/telemetry", json=abnormal_payload, headers=headers)
print("Status Code:", res2.status_code)
print("Response:", res2.json())
print()


# --- Test Case 3: Fetch Automated Health & Authenticity Report ---
print("--- 3. Generating Health & Tampering Report ---")
res3 = requests.get(f"{BASE_URL}/health-report/HONEY-BLOCK-99")
print("Status Code:", res3.status_code)
print("Health Report Output:")
print(res3.json())
print()


# --- Test Case 4: Cryptographic Blockchain Ledger Audit ---
print("--- 4. Public Blockchain Ledger Audit ---")
res4 = requests.get(f"{BASE_URL}/verify/HONEY-BLOCK-99")
print("Status Code:", res4.status_code)
print("Ledger Hash Chain Output:")
print(res4.json())