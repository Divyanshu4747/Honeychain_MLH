import os
import json
import hashlib
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import schemas
from database import engine, get_db

# --- CONFIGURATION ---
API_KEY = "sih2026_secret_cadastral_key_99"
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key == API_KEY:
        return api_key
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Invalid or missing X-API-Key header"
    )

# --- HELPER: Cryptographic Ledger Hash Function ---
def compute_hash(previous_hash: str, event_data: dict) -> str:
    payload = (previous_hash or "") + json.dumps(event_data, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()

def create_ledger_block(db: Session, hive_id: str, event_data: dict):
    last_block = db.query(models.LedgerEntry).filter(
        models.LedgerEntry.hive_id == hive_id
    ).order_by(models.LedgerEntry.id.desc()).first()

    prev_hash = last_block.current_hash if last_block else None
    curr_hash = compute_hash(prev_hash, event_data)

    ledger_entry = models.LedgerEntry(
        hive_id=hive_id,
        event_data=json.dumps(event_data),
        previous_hash=prev_hash,
        current_hash=curr_hash
    )
    db.add(ledger_entry)
    db.commit()
    db.refresh(ledger_entry)
    return ledger_entry

# --- APP SETUP ---
models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="Honey Chain Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- PUBLIC ROUTES ---
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Honey Chain system fully operational"}

@app.get("/telemetry/{hive_id}", response_model=List[schemas.TelemetryResponse])
def get_telemetry_by_hive(hive_id: str, db: Session = Depends(get_db)):
    """Public endpoint for QR scanner app to view telemetry and AI verification."""
    readings = db.query(models.HiveTelemetry).filter(models.HiveTelemetry.hive_id == hive_id).all()
    if not readings:
        raise HTTPException(status_code=404, detail="Hive ID not found")
    return readings

@app.get("/verify/{hive_id}")
def verify_blockchain_ledger(hive_id: str, db: Session = Depends(get_db)):
    """Public verification page returning complete hash-chained audit trail."""
    chain = db.query(models.LedgerEntry).filter(
        models.LedgerEntry.hive_id == hive_id
    ).order_by(models.LedgerEntry.id.asc()).all()
    
    if not chain:
        raise HTTPException(status_code=404, detail="No ledger records found for this hive ID")
    
    return {
        "hive_id": hive_id,
        "total_ledger_blocks": len(chain),
        "ledger_chain": chain
    }

# --- INGESTION ROUTE (HARDWARE + AI) ---
@app.post("/telemetry", response_model=schemas.TelemetryResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_api_key)])
def create_telemetry(data: schemas.TelemetryCreate, db: Session = Depends(get_db)):
    # 1. Store Raw Telemetry & AI Prediction
    new_reading = models.HiveTelemetry(**data.model_dump())
    db.add(new_reading)
    db.commit()
    db.refresh(new_reading)

    # 2. Automatically Mine Immutable Ledger Block (Cryptographic Hash-Chain)
    event_payload = {
        "temperature": data.temperature,
        "humidity": data.humidity,
        "weight": data.weight,
        "ai_prediction": data.ai_prediction
    }
    create_ledger_block(db, hive_id=data.hive_id, event_data=event_payload)

    return new_reading

@app.get("/telemetry", response_model=List[schemas.TelemetryResponse], dependencies=[Depends(verify_api_key)])
def get_all_telemetry(db: Session = Depends(get_db)):
    """Internal audit route listing all records in reverse-chronological order."""
    return db.query(models.HiveTelemetry).order_by(models.HiveTelemetry.created_at.desc()).all()

# Add Twilio import at the top of backend/main.py
from twilio.rest import Client

# Twilio Credentials (or use Fast2SMS / Mock for local dev)
TWILIO_ACCOUNT_SID = "your_account_sid"
TWILIO_AUTH_TOKEN = "your_auth_token"
TWILIO_PHONE_NUMBER = "+1234567890"
FARMER_PHONE_NUMBER = "+919876543210"

def send_farmer_sms_alert(hive_id: str, message_body: str):
    """Sends an emergency SMS alert to the beekeeper when an anomaly is detected."""
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=f"🚨 [HONEY CHAIN ALERT] Hive {hive_id}: {message_body}",
            from_=TWILIO_PHONE_NUMBER,
            to=FARMER_PHONE_NUMBER
        )
    except Exception as e:
        print(f"SMS Sending Failed (Demo fallback): {e}")

# Update your POST /telemetry route in backend/main.py:
@app.post("/telemetry", response_model=schemas.TelemetryResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_api_key)])
def create_telemetry(data: schemas.TelemetryCreate, db: Session = Depends(get_db)):
    # 1. Store Raw Telemetry
    new_reading = models.HiveTelemetry(**data.model_dump())
    db.add(new_reading)
    db.commit()
    db.refresh(new_reading)

    # 2. Check for Warning Data (Strange Info / Temperature Spikes / Syrup Adulteration)
    warnings = []
    if data.temperature < 15.0 or data.temperature > 40.0:
        warnings.append(f"Critical temperature detected: {data.temperature}°C")
    
    if data.ai_prediction and data.ai_prediction.get("adulteration_flag") == True:
        warnings.append("AI Warning: Possible Sugar Syrup Feeding detected!")

    # 3. If Warnings Found -> Trigger SMS Alert to Farmer
    if warnings:
        alert_text = " | ".join(warnings)
        send_farmer_sms_alert(data.hive_id, alert_text)

    # 4. Mine Blockchain Ledger Block
    event_payload = {
        "temperature": data.temperature,
        "humidity": data.humidity,
        "weight": data.weight,
        "ai_prediction": data.ai_prediction,
        "warnings": warnings
    }
    create_ledger_block(db, hive_id=data.hive_id, event_data=event_payload)

    return new_reading

# New Endpoint: Farmer Health & Authenticity Report
@app.get("/health-report/{hive_id}")
def get_hive_health_report(hive_id: str, db: Session = Depends(get_db)):
    readings = db.query(models.HiveTelemetry).filter(models.HiveTelemetry.hive_id == hive_id).all()
    if not readings:
        raise HTTPException(status_code=404, detail="No readings found for health calculation")

    # Simple logic calculating score based on abnormal readings
    total_readings = len(readings)
    anomalies = sum(1 for r in readings if r.temperature > 40 or r.temperature < 15)
    health_score = max(0.0, 100.0 - ((anomalies / total_readings) * 100.0))

    return {
        "hive_id": hive_id,
        "overall_health_score": f"{health_score:.1f}%",
        "total_audited_logs": total_readings,
        "farmer_tampering_risk": "LOW" if health_score > 80 else "HIGH (Syrup/Temperature Anomaly)",
        "status": "Healthy & Natural" if health_score > 80 else "Attention Required"
    }