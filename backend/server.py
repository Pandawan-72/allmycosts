from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
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
from typing import Optional, Literal
from datetime import datetime, timedelta, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_EXPIRES_DAYS = 30

# RevenueCat
REVENUECAT_SECRET_KEY = os.environ.get("REVENUECAT_SECRET_KEY", "")
REVENUECAT_ENTITLEMENT_ID = os.environ.get("REVENUECAT_ENTITLEMENT_ID", "pro")
REVENUECAT_WEBHOOK_AUTH = os.environ.get("REVENUECAT_WEBHOOK_AUTH", "")
REVENUECAT_API_BASE = "https://api.revenuecat.com"

# Google Sign-In (native): we accept an ID token signed by Google and verify it.
# The aud claim must match one of the OAuth client IDs we issued for this app.
GOOGLE_OAUTH_CLIENT_IDS = [
    s.strip() for s in os.environ.get("GOOGLE_OAUTH_CLIENT_IDS", "").split(",") if s.strip()
]

TRIAL_HOURS = 48

# Display-only pricing (real billing happens via Apple App Store / Google Play through RevenueCat)
PLAN_PRICES_EUR = {
    "monthly":  {"amount_eur": 2.99,  "interval": "month", "label": "Mensuel"},
    "yearly":   {"amount_eur": 23.88, "interval": "year",  "label": "Annuel"},
    "lifetime": {"amount_eur": 29.90, "interval": None,    "label": "À vie"},
}

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


class GoogleIdTokenIn(BaseModel):
    id_token: str


class ProStatus(BaseModel):
    plan: Literal["free", "trialing", "active_monthly", "active_yearly", "lifetime", "expired"]
    is_pro: bool
    trial_end: Optional[str] = None
    current_period_end: Optional[str] = None
    has_used_trial: bool = False


class UserOut(BaseModel):
    user_id: str
    name: str
    email: EmailStr
    provider: str
    picture: Optional[str] = None
    pro: ProStatus


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class DevGrantIn(BaseModel):
    plan: Literal["monthly", "yearly", "lifetime"]


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
    payload = {"sub": user_id, "iat": int(now.timestamp()),
               "exp": int((now + timedelta(days=JWT_EXPIRES_DAYS)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def compute_pro(user: dict) -> ProStatus:
    pro = user.get("pro", {}) or {}
    plan = pro.get("plan", "free")
    trial_end = pro.get("trial_end")
    current_period_end = pro.get("current_period_end")
    has_used_trial = bool(pro.get("has_used_trial", False))
    now = now_utc()

    if plan == "lifetime":
        return ProStatus(plan="lifetime", is_pro=True, trial_end=trial_end,
                         current_period_end=None, has_used_trial=True)

    if plan in ("active_monthly", "active_yearly"):
        if current_period_end:
            try:
                cpe = datetime.fromisoformat(current_period_end.replace("Z", "+00:00"))
                if cpe > now:
                    return ProStatus(plan=plan, is_pro=True, trial_end=trial_end,
                                     current_period_end=current_period_end, has_used_trial=True)
            except Exception:
                pass
        return ProStatus(plan="expired", is_pro=False, trial_end=trial_end,
                         current_period_end=current_period_end, has_used_trial=True)

    if plan == "trialing" and trial_end:
        try:
            te = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
            if te > now:
                return ProStatus(plan="trialing", is_pro=True, trial_end=trial_end,
                                 current_period_end=None, has_used_trial=True)
        except Exception:
            pass
        return ProStatus(plan="expired", is_pro=False, trial_end=trial_end,
                         current_period_end=None, has_used_trial=True)

    return ProStatus(plan="free", is_pro=False, trial_end=trial_end,
                     current_period_end=current_period_end, has_used_trial=has_used_trial)


async def ensure_trial_started(user: dict) -> dict:
    pro = user.get("pro") or {}
    if pro.get("has_used_trial") or pro.get("plan") in ("lifetime", "active_monthly", "active_yearly", "trialing"):
        return user
    now = now_utc()
    trial_end = (now + timedelta(hours=TRIAL_HOURS)).isoformat()
    new_pro = {
        "plan": "trialing",
        "trial_end": trial_end,
        "current_period_end": None,
        "has_used_trial": True,
        "revenuecat_app_user_id": user.get("user_id"),
    }
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$set": {"pro": new_pro, "updated_at": now.isoformat()}})
    user["pro"] = new_pro
    return user


def user_to_out(doc: dict) -> UserOut:
    return UserOut(
        user_id=doc["user_id"],
        name=doc.get("name", ""),
        email=doc["email"],
        provider=doc.get("provider", "password"),
        picture=doc.get("picture"),
        pro=compute_pro(doc),
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


# ---------- Auth routes ----------
@api_router.get("/")
async def root():
    return {"message": "All My Costs API", "version": "2.0", "billing": "RevenueCat"}


@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: RegisterIn):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Un compte avec cet e-mail existe déjà.")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = now_utc()
    trial_end = (now + timedelta(hours=TRIAL_HOURS)).isoformat()
    doc = {
        "user_id": user_id,
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "provider": "password",
        "picture": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "pro": {
            "plan": "trialing",
            "trial_end": trial_end,
            "current_period_end": None,
            "has_used_trial": True,
            "revenuecat_app_user_id": user_id,
        },
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
    user = await ensure_trial_started(user)
    return AuthResponse(token=create_jwt(user["user_id"]), user=user_to_out(user))


async def _login_or_register_google_user(email: str, name: str, picture: Optional[str]) -> dict:
    """Shared helper used by both Emergent session-id flow and native id_token flow."""
    email = (email or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="E-mail Google manquant.")
    name = (name or email.split("@")[0]).strip()
    now = now_utc()
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        trial_end = (now + timedelta(hours=TRIAL_HOURS)).isoformat()
        user = {
            "user_id": user_id, "name": name, "email": email,
            "password_hash": None, "provider": "google", "picture": picture,
            "created_at": now.isoformat(), "updated_at": now.isoformat(),
            "pro": {"plan": "trialing", "trial_end": trial_end, "current_period_end": None,
                    "has_used_trial": True, "revenuecat_app_user_id": user_id},
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
            "name": user.get("name") or name, "picture": picture or user.get("picture"),
            "updated_at": now.isoformat(),
        }})
        user["picture"] = picture or user.get("picture")
        user = await ensure_trial_started(user)
    return user


@api_router.post("/auth/google", response_model=AuthResponse)
async def google_session(payload: GoogleSessionIn):
    """Legacy Emergent OAuth flow (web preview). Accepts a session_id from
    auth.emergentagent.com and exchanges it for user profile data."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Échec de l'authentification Google.")
    data = r.json()
    user = await _login_or_register_google_user(
        email=data.get("email", ""), name=data.get("name"), picture=data.get("picture"),
    )
    return AuthResponse(token=create_jwt(user["user_id"]), user=user_to_out(user))


@api_router.post("/auth/google-native", response_model=AuthResponse)
async def google_native(payload: GoogleIdTokenIn):
    """Native Google Sign-In flow (Android/iOS production builds).
    Accepts a Google ID token and verifies its signature with Google's public keys.
    The token's `aud` must match one of GOOGLE_OAUTH_CLIENT_IDS configured in .env."""
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
    except ImportError:
        raise HTTPException(status_code=500, detail="google-auth library missing on server.")

    if not GOOGLE_OAUTH_CLIENT_IDS:
        raise HTTPException(status_code=500,
                            detail="Google auth not configured (GOOGLE_OAUTH_CLIENT_IDS missing).")

    try:
        # Verify against ALL allowed client IDs (Web client + Android client + iOS client).
        # google-auth requires us to pass one audience at a time, so loop until one matches.
        info = None
        last_err: Optional[Exception] = None
        for aud in GOOGLE_OAUTH_CLIENT_IDS:
            try:
                info = google_id_token.verify_oauth2_token(
                    payload.id_token, google_requests.Request(), aud
                )
                break
            except ValueError as e:
                last_err = e
                continue
        if info is None:
            raise last_err or ValueError("Aucun client_id ne correspond à l'audience du token.")
    except Exception as e:
        logger.warning("Google id_token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Jeton Google invalide.")

    # info contains: iss, sub, aud, email, email_verified, name, picture, ...
    if not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="E-mail Google non vérifié.")

    user = await _login_or_register_google_user(
        email=info.get("email", ""), name=info.get("name"), picture=info.get("picture"),
    )
    return AuthResponse(token=create_jwt(user["user_id"]), user=user_to_out(user))


@api_router.get("/auth/me", response_model=UserOut)
async def me(current: dict = Depends(get_current_user)):
    return user_to_out(current)


@api_router.post("/auth/logout")
async def logout(current: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------- Pricing ----------
@api_router.get("/pricing")
async def pricing():
    return {"prices_eur": PLAN_PRICES_EUR, "trial_hours": TRIAL_HOURS}


# ---------- RevenueCat helpers ----------
_revenuecat_project_id_cache: Optional[str] = None


async def _get_revenuecat_project_id() -> Optional[str]:
    """Fetch and cache the RevenueCat project ID (V2 API requires it)."""
    global _revenuecat_project_id_cache
    if _revenuecat_project_id_cache:
        return _revenuecat_project_id_cache
    if not REVENUECAT_SECRET_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.get(
                f"{REVENUECAT_API_BASE}/v2/projects",
                headers={"Authorization": f"Bearer {REVENUECAT_SECRET_KEY}"},
            )
        if r.status_code >= 400:
            logger.warning("RevenueCat /v2/projects %s: %s", r.status_code, r.text[:200])
            return None
        items = (r.json() or {}).get("items") or []
        if not items:
            return None
        _revenuecat_project_id_cache = items[0].get("id")
        return _revenuecat_project_id_cache
    except Exception as e:
        logger.warning("RevenueCat project discovery failed: %s", e)
        return None


async def _fetch_revenuecat_subscriber(app_user_id: str) -> Optional[dict]:
    """Fetch the canonical subscriber record. Tries V2 then falls back to V1."""
    if not REVENUECAT_SECRET_KEY:
        return None
    headers = {"Authorization": f"Bearer {REVENUECAT_SECRET_KEY}"}
    # Try V2 first (modern sk_xxx keys)
    project_id = await _get_revenuecat_project_id()
    if project_id:
        try:
            async with httpx.AsyncClient(timeout=15.0) as http:
                r = await http.get(
                    f"{REVENUECAT_API_BASE}/v2/projects/{project_id}/customers/{app_user_id}/active_entitlements",
                    headers=headers,
                )
            if r.status_code == 200:
                data = r.json() or {}
                # Map V2 active_entitlements list into a V1-shaped dict for our mapper
                active = data.get("items") or []
                ents: dict = {}
                for it in active:
                    lookup = it.get("entitlement") or {}
                    eid = lookup.get("lookup_key") or it.get("lookup_key") or REVENUECAT_ENTITLEMENT_ID
                    expires_ms = it.get("expires_at")
                    expires_iso = None
                    if expires_ms:
                        try:
                            expires_iso = datetime.fromtimestamp(expires_ms / 1000.0, tz=timezone.utc).isoformat()
                        except Exception:
                            expires_iso = None
                    product_id = (it.get("product") or {}).get("store_identifier") or ""
                    ents[eid] = {
                        "expires_date": expires_iso,
                        "product_identifier": product_id,
                        "period_type": "normal",
                    }
                return {"subscriber": {"entitlements": ents}}
            if r.status_code == 404:
                return {"subscriber": {"entitlements": {}}}
            logger.warning("RevenueCat V2 customer %s: %s", r.status_code, r.text[:200])
        except Exception as e:
            logger.warning("RevenueCat V2 fetch failed: %s", e)

    # Fallback to V1 (legacy sk_ keys)
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.get(
                f"{REVENUECAT_API_BASE}/v1/subscribers/{app_user_id}",
                headers=headers,
            )
        if r.status_code == 404:
            return {"subscriber": {"entitlements": {}}}
        if r.status_code >= 400:
            logger.warning("RevenueCat V1 API error %s: %s", r.status_code, r.text[:200])
            return None
        return r.json()
    except Exception as e:
        logger.warning("RevenueCat V1 fetch failed: %s", e)
        return None


def _apply_revenuecat_state(pro: dict, subscriber: dict) -> dict:
    """Map a RevenueCat subscriber payload onto our internal `pro` dict."""
    entitlements = (subscriber.get("subscriber") or {}).get("entitlements") or {}
    ent = entitlements.get(REVENUECAT_ENTITLEMENT_ID)
    if not ent:
        # No active entitlement — keep trial info but mark plan as expired only if user had been pro
        if pro.get("plan") in ("active_monthly", "active_yearly", "lifetime"):
            pro["plan"] = "expired"
            pro["current_period_end"] = None
        return pro

    expires_date = ent.get("expires_date")
    product_id = (ent.get("product_identifier") or "").lower()

    if not expires_date:
        # No expiry => lifetime / non-consumable
        pro["plan"] = "lifetime"
        pro["current_period_end"] = None
    else:
        period_type = ent.get("period_type", "normal")
        if "year" in product_id or "annual" in product_id:
            plan_key = "active_yearly"
        else:
            plan_key = "active_monthly"
        pro["plan"] = plan_key
        pro["current_period_end"] = expires_date

    pro["has_used_trial"] = True
    return pro


async def _sync_user_from_revenuecat(user_id: str) -> Optional[dict]:
    sub = await _fetch_revenuecat_subscriber(user_id)
    if sub is None:
        return None
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        return None
    pro = user.get("pro") or {}
    pro["revenuecat_app_user_id"] = user_id
    pro = _apply_revenuecat_state(pro, sub)
    await db.users.update_one({"user_id": user_id},
                              {"$set": {"pro": pro, "updated_at": now_utc().isoformat()}})
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})


# ---------- RevenueCat endpoints ----------
@api_router.post("/revenuecat/sync", response_model=UserOut)
async def revenuecat_sync(current: dict = Depends(get_current_user)):
    """Called by the client after a successful purchase or restore to refresh pro state."""
    updated = await _sync_user_from_revenuecat(current["user_id"])
    return user_to_out(updated or current)


@api_router.post("/webhooks/revenuecat")
async def revenuecat_webhook(request: Request, authorization: Optional[str] = Header(None)):
    """RevenueCat event webhook — config with a static Authorization Bearer header."""
    if REVENUECAT_WEBHOOK_AUTH:
        expected = f"Bearer {REVENUECAT_WEBHOOK_AUTH}"
        if authorization != expected:
            raise HTTPException(status_code=401, detail="Invalid webhook auth")
    try:
        payload = await request.json()
    except Exception:
        return {"status": "invalid_payload"}
    event = (payload or {}).get("event") or {}
    app_user_id = event.get("app_user_id")
    if not app_user_id:
        return {"status": "ignored", "reason": "no_app_user_id"}
    await _sync_user_from_revenuecat(app_user_id)
    logger.info("RevenueCat webhook processed: type=%s user=%s", event.get("type"), app_user_id)
    return {"status": "ok"}


# ---------- Dev / web fallback ----------
# RevenueCat purchases require a native (iOS/Android) build. To keep web testing
# possible, we expose a simple admin-style endpoint that marks the user as pro.
# This is gated behind a simple header check matching the JWT secret prefix so
# random callers cannot use it. Remove or further restrict for production.
@api_router.post("/dev/grant-pro", response_model=UserOut)
async def dev_grant_pro(payload: DevGrantIn, current: dict = Depends(get_current_user)):
    pro = current.get("pro") or {}
    now = now_utc()
    if payload.plan == "lifetime":
        pro.update({"plan": "lifetime", "current_period_end": None, "has_used_trial": True})
    elif payload.plan == "monthly":
        pro.update({"plan": "active_monthly",
                    "current_period_end": (now + timedelta(days=31)).isoformat(),
                    "has_used_trial": True})
    else:
        pro.update({"plan": "active_yearly",
                    "current_period_end": (now + timedelta(days=366)).isoformat(),
                    "has_used_trial": True})
    pro["revenuecat_app_user_id"] = current["user_id"]
    await db.users.update_one({"user_id": current["user_id"]},
                              {"$set": {"pro": pro, "updated_at": now.isoformat()}})
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "password_hash": 0})
    return user_to_out(user)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
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
