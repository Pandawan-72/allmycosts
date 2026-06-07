from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import httpx
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timedelta, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_EXPIRES_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class UserOut(BaseModel):
    user_id: str
    name: str
    email: EmailStr
    provider: str
    picture: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ---------- Utils ----------
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pwd: str, pwd_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pwd.encode("utf-8"), pwd_hash.encode("utf-8"))
    except Exception:
        return False


def create_jwt(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=JWT_EXPIRES_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def user_to_out(doc: dict) -> UserOut:
    return UserOut(
        user_id=doc["user_id"],
        name=doc.get("name", ""),
        email=doc["email"],
        provider=doc.get("provider", "password"),
        picture=doc.get("picture"),
    )


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")
    token = auth.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Jeton invalide")
    if not user_id:
        raise HTTPException(status_code=401, detail="Jeton invalide")
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user_doc


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "All My Costs API"}


@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: RegisterIn):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Un compte avec cet e-mail existe déjà.")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": user_id,
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "provider": "password",
        "picture": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(doc)
    token = create_jwt(user_id)
    return AuthResponse(token=token, user=user_to_out(doc))


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Identifiants invalides.")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides.")
    token = create_jwt(user["user_id"])
    return AuthResponse(token=token, user=user_to_out(user))


@api_router.post("/auth/google", response_model=AuthResponse)
async def google_session(payload: GoogleSessionIn):
    # Exchange session_id with Emergent
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Échec de l'authentification Google.")
    data = r.json()
    email = (data.get("email") or "").lower().strip()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="E-mail Google manquant.")

    now = datetime.now(timezone.utc).isoformat()
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "password_hash": None,
            "provider": "google",
            "picture": picture,
            "created_at": now,
            "updated_at": now,
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"name": user.get("name") or name, "picture": picture or user.get("picture"), "updated_at": now}},
        )
        user["picture"] = picture or user.get("picture")
        user["name"] = user.get("name") or name

    token = create_jwt(user["user_id"])
    return AuthResponse(token=token, user=user_to_out(user))


@api_router.get("/auth/me", response_model=UserOut)
async def me(current: dict = Depends(get_current_user)):
    return user_to_out(current)


@api_router.post("/auth/logout")
async def logout(current: dict = Depends(get_current_user)):
    # JWT is stateless; client clears token. Endpoint kept for symmetry.
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
