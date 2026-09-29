"""
Blockbees Backend - Main Entry Point
FastAPI application for the Blockbees bee farmer platform.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(
    title="Blockbees API",
    description="Backend API for the Blockbees bee farmer platform",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("APP_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"app": "Blockbees API", "status": "running", "version": "0.1.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Uncomment routes as you build them:
# from routes import farmers, marketplace, schemes, chatbot, auth
# app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
# app.include_router(farmers.router, prefix="/api/farmers", tags=["Farmers"])
# app.include_router(marketplace.router, prefix="/api/marketplace", tags=["Marketplace"])
# app.include_router(schemes.router, prefix="/api/schemes", tags=["Schemes"])
# app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("APP_PORT", 8000)), reload=True)
