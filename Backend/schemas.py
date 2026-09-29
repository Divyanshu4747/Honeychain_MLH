from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime

# --- Telemetry Schemas ---
class TelemetryBase(BaseModel):
    hive_id: str
    temperature: float
    humidity: float
    weight: float
    sound_frequency: Optional[float] = None
    ai_prediction: Optional[Dict[str, Any]] = None

class TelemetryCreate(TelemetryBase):
    pass

class TelemetryResponse(TelemetryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- User & Auth Schemas ---
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "beekeeper"

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Verification Response Schema ---
class LedgerResponse(BaseModel):
    id: int
    hive_id: str
    event_data: str
    previous_hash: Optional[str]
    current_hash: str
    created_at: datetime

    class Config:
        from_attributes = True