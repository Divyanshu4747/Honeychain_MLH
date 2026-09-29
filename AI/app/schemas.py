"""
schemas.py

Shared Pydantic models used by the REST endpoints (and, where relevant,
BeeSaathi's chatbot tools), so validation rules live in exactly one place.
"""

from pydantic import BaseModel, Field


# ---------- Hive Health ----------
class HiveData(BaseModel):
    temperature: float
    humidity: float = Field(ge=0, le=100)
    hive_weight: float = Field(gt=0)
    weight_change: float


# ---------- Honey Yield ----------
class YieldData(BaseModel):
    temperature: float
    humidity: float = Field(ge=0, le=100)
    hive_weight: float = Field(gt=0)
    weight_change: float  # can be positive or negative
    rainfall: float = Field(ge=0)
    flowering_index: float = Field(ge=0, le=1)
    previous_yield: float = Field(ge=0)


# ---------- BeeSaathi Chat ----------
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User's message to BeeSaathi")


class ChatResponse(BaseModel):
    response: str


# ---------- Anomaly / Fraud Detection ----------
class AnomalyData(BaseModel):
    temperature: float
    humidity: float = Field(ge=0, le=100)
    hive_weight: float = Field(gt=0)
    weight_change: float  # can be positive or negative
    honey_yield: float = Field(ge=0, description="Actual harvested honey in kg for this record")
    rainfall: float = Field(ge=0)
    flowering_index: float = Field(ge=0, le=1)
    previous_yield: float = Field(ge=0)