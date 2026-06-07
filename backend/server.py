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
import stripe
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

# Stripe
stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "")
TRIAL_HOURS = 48

# All prices are in EUR (cents). Display is locale-converted client-side.
PLAN_PRICES_EUR = {
    "monthly": {"amount_cents": 299, "interval": "month", "label": "Mensuel"},
    "yearly":  {"amount_cents": 2388, "interval": "year",  "label": "Annuel"},
    "lifetime": {"amount_cents": 6900, "interval": None,   "label": "À vie"},
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


class CheckoutIn(BaseModel):
    plan: Literal["monthly", "yearly", "lifetime"]
    success_url: str
    cancel_url: str


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
    """Determine the user's effective pro status. The 48h trial starts at first login."""
    pro = user.get("pro", {}) or {}
    plan = pro.get("plan", "free")
    trial_end = pro.get("trial_end")
    current_period_end = pro.get("current_period_end")
    has_used_trial = bool(pro.get("has_used_trial", False))

    now = now_utc()

    # Auto-promote: if no plan but trial not yet used, start the 48h trial now.
    # (We start the trial implicitly the first time `compute_pro` is called for a free user.)
    # We do NOT modify the DB here; the actual write is done in `ensure_trial_started`.

    if plan == "lifetime":
        return ProStatus(plan="lifetime", is_pro=True, trial_end=None,
                         current_period_end=None, has_used_trial=True)

    if plan in ("active_monthly", "active_yearly"):
        if current_period_end:
            cpe = datetime.fromisoformat(current_period_end)
            if cpe > now:
                return ProStatus(plan=plan, is_pro=True, trial_end=trial_end,
                                 current_period_end=current_period_end, has_used_trial=True)
        # period expired
        return ProStatus(plan="expired", is_pro=False, trial_end=trial_end,
                         current_period_end=current_period_end, has_used_trial=True)

    if plan == "trialing" and trial_end:
        te = datetime.fromisoformat(trial_end)
        if te > now:
            return ProStatus(plan="trialing", is_pro=True, trial_end=trial_end,
                             current_period_end=None, has_used_trial=True)
        return ProStatus(plan="expired", is_pro=False, trial_end=trial_end,
                         current_period_end=None, has_used_trial=True)

    # free / unknown
    return ProStatus(plan="free", is_pro=False, trial_end=trial_end,
                     current_period_end=current_period_end, has_used_trial=has_used_trial)


async def ensure_trial_started(user: dict) -> dict:
    """Start the 48h free trial automatically for a new free user (only once)."""
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
        "stripe_customer_id": pro.get("stripe_customer_id"),
        "stripe_subscription_id": pro.get("stripe_subscription_id"),
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
    return {"message": "All My Costs API", "version": "1.0"}


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
        # Auto-start 48h trial on signup
        "pro": {
            "plan": "trialing",
            "trial_end": trial_end,
            "current_period_end": None,
            "has_used_trial": True,
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
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


@api_router.post("/auth/google", response_model=AuthResponse)
async def google_session(payload: GoogleSessionIn):
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
                    "has_used_trial": True, "stripe_customer_id": None, "stripe_subscription_id": None},
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
            "name": user.get("name") or name, "picture": picture or user.get("picture"),
            "updated_at": now.isoformat(),
        }})
        user["picture"] = picture or user.get("picture")
        user = await ensure_trial_started(user)
    return AuthResponse(token=create_jwt(user["user_id"]), user=user_to_out(user))


@api_router.get("/auth/me", response_model=UserOut)
async def me(current: dict = Depends(get_current_user)):
    return user_to_out(current)


@api_router.post("/auth/logout")
async def logout(current: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------- Pricing / FX info ----------
@api_router.get("/pricing")
async def pricing():
    return {"prices_eur": PLAN_PRICES_EUR, "trial_hours": TRIAL_HOURS}


# ---------- Stripe ----------
async def _ensure_stripe_customer(user: dict) -> str:
    pro = user.get("pro") or {}
    cid = pro.get("stripe_customer_id")
    if cid:
        return cid
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Paiement non configuré.")
    customer = stripe.Customer.create(email=user["email"], name=user.get("name"),
                                      metadata={"app_user_id": user["user_id"]})
    cid = customer["id"]
    pro["stripe_customer_id"] = cid
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$set": {"pro": pro, "updated_at": now_utc().isoformat()}})
    return cid


@api_router.post("/stripe/checkout")
async def stripe_checkout(payload: CheckoutIn, current: dict = Depends(get_current_user)):
    if not stripe.api_key or stripe.api_key == "sk_test_emergent":
        # Stub mode: return a fake URL so the UI flow can be tested
        return {
            "url": f"{payload.success_url}?stub=1&plan={payload.plan}",
            "stub": True,
            "message": "Stripe test key non configurée. Connectez votre clé sk_test_... dans backend/.env.",
        }
    customer_id = await _ensure_stripe_customer(current)
    plan = payload.plan
    info = PLAN_PRICES_EUR[plan]
    line_items = [{
        "price_data": {
            "currency": "eur",
            "product_data": {"name": f"All My Costs Pro — {info['label']}"},
            "unit_amount": info["amount_cents"],
            **({"recurring": {"interval": info["interval"]}} if info["interval"] else {}),
        },
        "quantity": 1,
    }]
    mode = "subscription" if info["interval"] else "payment"
    create_args = {
        "mode": mode,
        "customer": customer_id,
        "line_items": line_items,
        "success_url": payload.success_url,
        "cancel_url": payload.cancel_url,
        "client_reference_id": current["user_id"],
        "metadata": {"app_user_id": current["user_id"], "plan": plan},
    }
    try:
        session = stripe.checkout.Session.create(**create_args)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Stripe: {e}")
    return {"url": session["url"], "stub": False}


@api_router.post("/stripe/confirm-stub")
async def stripe_confirm_stub(payload: dict, current: dict = Depends(get_current_user)):
    """Test-mode helper: manually mark a user as pro when Stripe isn't fully wired.
    Should be removed in production once a real Stripe key + webhook are in place."""
    if stripe.api_key and stripe.api_key != "sk_test_emergent":
        raise HTTPException(status_code=403, detail="Endpoint réservé au mode test.")
    plan = payload.get("plan")
    if plan not in ("monthly", "yearly", "lifetime"):
        raise HTTPException(status_code=400, detail="plan invalide")
    pro = current.get("pro") or {}
    now = now_utc()
    if plan == "lifetime":
        pro.update({"plan": "lifetime", "current_period_end": None, "trial_end": pro.get("trial_end"),
                    "has_used_trial": True})
    elif plan == "monthly":
        pro.update({"plan": "active_monthly",
                    "current_period_end": (now + timedelta(days=31)).isoformat(),
                    "has_used_trial": True})
    else:
        pro.update({"plan": "active_yearly",
                    "current_period_end": (now + timedelta(days=366)).isoformat(),
                    "has_used_trial": True})
    await db.users.update_one({"user_id": current["user_id"]},
                              {"$set": {"pro": pro, "updated_at": now.isoformat()}})
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "password_hash": 0})
    return user_to_out(user).model_dump()


@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature")):
    payload = await request.body()
    if not STRIPE_WEBHOOK_SECRET:
        # Webhook not configured; ignore silently for dev
        return {"received": True, "ignored": True}
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="signature invalide")
    obj = event["data"]["object"]
    etype = event["type"]
    if etype == "checkout.session.completed":
        await _handle_checkout_completed(obj)
    elif etype in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
        await _handle_subscription_event(obj)
    return {"received": True}


async def _handle_checkout_completed(session: dict):
    app_user_id = session.get("client_reference_id") or (session.get("metadata") or {}).get("app_user_id")
    if not app_user_id:
        return
    if session.get("mode") == "payment" and session.get("payment_status") == "paid":
        user = await db.users.find_one({"user_id": app_user_id})
        if not user:
            return
        pro = user.get("pro") or {}
        pro.update({"plan": "lifetime", "current_period_end": None, "has_used_trial": True})
        await db.users.update_one({"user_id": app_user_id},
                                  {"$set": {"pro": pro, "updated_at": now_utc().isoformat()}})


async def _handle_subscription_event(sub: dict):
    app_user_id = (sub.get("metadata") or {}).get("app_user_id")
    if not app_user_id:
        customer_id = sub.get("customer")
        u = await db.users.find_one({"pro.stripe_customer_id": customer_id})
        if u:
            app_user_id = u["user_id"]
    if not app_user_id:
        return
    user = await db.users.find_one({"user_id": app_user_id})
    if not user:
        return
    pro = user.get("pro") or {}
    status = sub.get("status")
    cpe = sub.get("current_period_end")
    cpe_iso = datetime.fromtimestamp(cpe, tz=timezone.utc).isoformat() if cpe else None
    interval = (((sub.get("items") or {}).get("data") or [{}])[0].get("price") or {}).get("recurring", {}).get("interval")
    if status in ("active", "trialing"):
        plan_key = "active_yearly" if interval == "year" else "active_monthly"
        pro.update({"plan": plan_key, "current_period_end": cpe_iso, "has_used_trial": True,
                    "stripe_subscription_id": sub.get("id")})
    elif status in ("canceled", "unpaid", "incomplete_expired"):
        pro.update({"plan": "expired", "current_period_end": cpe_iso})
    await db.users.update_one({"user_id": app_user_id},
                              {"$set": {"pro": pro, "updated_at": now_utc().isoformat()}})


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
