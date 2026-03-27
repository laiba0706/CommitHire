"""
routes/auth.py — JWT authentication
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import hashlib, hmac, base64, json, time, os
from database import get_db, dict_cursor




router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET", "commithire-secret-2026-change-in-prod")


# ── Minimal JWT (no external library needed) ──────────────────────────────────
def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _make_token(user_id: int, email: str, name: str, role: str) -> str:
    header  = _b64(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
    payload = _b64(json.dumps({
        "sub": user_id, "email": email, "name": name, "role": role,
        "iat": int(time.time()), "exp": int(time.time()) + 86400 * 7  # 7 days
    }).encode())
    sig = _b64(hmac.new(
        JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256
    ).digest())
    return f"{header}.{payload}.{sig}"

def _verify_token(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("bad format")
        header, payload, sig = parts
        expected_sig = _b64(hmac.new(
            JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256
        ).digest())
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("bad signature")
        # pad payload
        pad = 4 - len(payload) % 4
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * pad))
        if data.get("exp", 0) < time.time():
            raise ValueError("expired")
        return data
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

def _hash_password(pw: str) -> str:
    return hashlib.sha256((pw + JWT_SECRET).encode()).hexdigest()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return _verify_token(creds.credentials)


# ── Schemas ───────────────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/signup")
def signup(req: SignupRequest):
    db  = get_db()
    cur = dict_cursor(db)
    cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    if cur.fetchone():
        raise HTTPException(status_code=400, detail="Email already registered")
    pw_hash = _hash_password(req.password)
    cur2 = db.cursor()
    cur2.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (%s,%s,%s) RETURNING id",
        (req.name, req.email, pw_hash)
    )
    user_id = cur2.fetchone()[0]
    db.commit()
    cur.close(); cur2.close(); db.close()
    token = _make_token(user_id, req.email, req.name, "recruiter")
    return {"token": token, "user": {"id": user_id, "name": req.name, "email": req.email, "role": "recruiter"}}


@router.post("/login")
def login(req: LoginRequest):
    db  = get_db()
    cur = dict_cursor(db)
    cur.execute("SELECT * FROM users WHERE email = %s", (req.email,))
    user = cur.fetchone()
    cur.close(); db.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user["password_hash"] != _hash_password(req.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = _make_token(user["id"], user["email"], user["name"], user["role"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    db  = get_db()
    cur = dict_cursor(db)
    cur.execute("SELECT id, name, email, role, created_at FROM users WHERE id = %s", (current_user["sub"],))
    user = cur.fetchone()
    cur.close(); db.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)