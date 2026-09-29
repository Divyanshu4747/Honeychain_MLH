import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey, Text, Boolean
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="beekeeper")  # beekeeper, processor, admin
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class HiveTelemetry(Base):
    __tablename__ = "hive_telemetry"

    id = Column(Integer, primary_key=True, index=True)
    hive_id = Column(String, index=True, nullable=False)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    weight = Column(Float, nullable=False)
    sound_frequency = Column(Float, nullable=True)
    ai_prediction = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class LedgerEntry(Base):
    """Cryptographic hash-chain table (Blockchain Layer)"""
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    hive_id = Column(String, index=True, nullable=False)
    event_data = Column(Text, nullable=False)
    previous_hash = Column(String(64), nullable=True)
    current_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Add to backend/models.py
class HealthReport(BaseModel if False else Base):
    __tablename__ = "health_reports"

    id = Column(Integer, primary_key=True, index=True)
    hive_id = Column(String, index=True, nullable=False)
    health_score = Column(Float, nullable=False)  # e.g., 85.5%
    tampering_detected = Column(Boolean, default=False)
    warning_flags = Column(JSON, nullable=True)  # e.g., ["High Temperature", "Possible Sugar Syrup Feeding"]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)