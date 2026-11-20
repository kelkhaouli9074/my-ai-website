from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MY AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"name": "MY AI", "status": "online"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/chat")
def chat():
    return {"error": "AI provider not connected yet"}

@app.post("/image")
def image():
    return {"error": "Image generator not connected yet"}
