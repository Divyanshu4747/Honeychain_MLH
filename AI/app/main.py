from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import HiveData, YieldData, ChatRequest, ChatResponse, AnomalyData
from app.ml_utils import predict_hive_health, predict_honey_yield
from app.anomaly_utils import detect_anomaly
from app.beesathi import ask_beesaathi, BeeSaathiError


app = FastAPI(
    title="Honey Chain AI API",
    description="AI services for smart beekeeping",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "AI service running"}


@app.post("/predict/hive-health")
def predict_hive_health_endpoint(data: HiveData):
    return predict_hive_health(
        temperature=data.temperature,
        humidity=data.humidity,
        hive_weight=data.hive_weight,
        weight_change=data.weight_change,
    )


@app.post("/predict/yield")
def predict_honey_yield_endpoint(data: YieldData):
    return predict_honey_yield(
        temperature=data.temperature,
        humidity=data.humidity,
        hive_weight=data.hive_weight,
        weight_change=data.weight_change,
        rainfall=data.rainfall,
        flowering_index=data.flowering_index,
        previous_yield=data.previous_yield,
    )


@app.post("/detect/anomaly")
def detect_anomaly_endpoint(data: AnomalyData):
    try:
        return detect_anomaly(
            temperature=data.temperature,
            humidity=data.humidity,
            hive_weight=data.hive_weight,
            weight_change=data.weight_change,
            honey_yield=data.honey_yield,
            rainfall=data.rainfall,
            flowering_index=data.flowering_index,
            previous_yield=data.previous_yield,
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while analyzing this record. Please try again.",
        )


@app.post("/chat", response_model=ChatResponse)
def chat(data: ChatRequest):
    try:
        reply_text = ask_beesaathi(data.message)
    except BeeSaathiError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while talking to BeeSaathi. Please try again.",
        )

    return ChatResponse(response=reply_text)