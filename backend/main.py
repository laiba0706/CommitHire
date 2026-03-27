"""CommitHire API — main.py
Run: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routes.auth import router as auth_router
from routes.candidates import router as candidates_router
from routes.jobs import router as jobs_router
from routes.admin import router as admin_router

app = FastAPI(title="CommitHire API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:3000","http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(candidates_router)
app.include_router(jobs_router)
app.include_router(admin_router)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def root():
    return {"message":"CommitHire API v3.0","status":"running","docs":"/docs"}

@app.get("/api/health")
def health():
    return {"status":"ok"}