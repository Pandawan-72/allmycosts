"""
Backend regression tests for the Stripe -> RevenueCat refactor (All My Costs).

Scope:
  1. Auth still works after the refactor
  2. /api/revenuecat/sync endpoint (RevenueCat V2 backed)
  3. /api/webhooks/revenuecat (auth required)
  4. /api/dev/grant-pro (web fallback)
  5. Stripe endpoints removed
  6. /api/pricing unchanged

Uses the public preview URL from EXPO_PUBLIC_BACKEND_URL.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://subscription-tracker-43.preview.emergentagent.com"
).rstrip("/")

EXISTING_EMAIL = "test2@allmycosts.app"
EXISTING_PASSWORD = "secret123"

WEBHOOK_TOKEN = "rc_webhook_allmycosts_b7f3d2e1a9c4"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def existing_user_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD},
    )
    assert r.status_code == 200, f"login seed user failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture()
def fresh_user(api):
    """Create a fresh user and return (token, user, email)."""
    email = f"TEST_rc_{uuid.uuid4().hex[:10]}@allmycosts.app"
    payload = {"name": "RC Tester", "email": email, "password": "Secret123!"}
    r = api.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"], email


# =====================================================================
# 1. Auth regression
# =====================================================================
class TestAuthRegression:
    def test_register_creates_trial_user(self, api):
        email = f"TEST_reg_{uuid.uuid4().hex[:10]}@allmycosts.app"
        r = api.post(
            f"{BASE_URL}/api/auth/register",
            json={"name": "Trial Test", "email": email, "password": "Secret123!"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and body["token"]
        user = body["user"]
        # Backend lowercases emails on register — compare case-insensitively
        assert user["email"].lower() == email.lower()
        pro = user["pro"]
        assert pro["plan"] == "trialing", f"plan must be trialing, got {pro['plan']}"
        assert pro["has_used_trial"] is True
        assert pro["is_pro"] is True
        assert pro["trial_end"] is not None

    def test_login_existing_user(self, api, existing_user_token):
        # If fixture didn't raise, login worked
        assert isinstance(existing_user_token, str) and len(existing_user_token) > 20

    def test_login_wrong_password_401(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EXISTING_EMAIL, "password": "WRONG_PASSWORD"},
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

    def test_me_returns_user_payload(self, api, existing_user_token):
        r = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {existing_user_token}"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == EXISTING_EMAIL
        assert "pro" in data and "plan" in data["pro"]
        assert "is_pro" in data["pro"]

    def test_me_no_token_401(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# =====================================================================
# 2. RevenueCat sync
# =====================================================================
class TestRevenueCatSync:
    def test_sync_without_auth_401(self, api):
        r = api.post(f"{BASE_URL}/api/revenuecat/sync")
        assert r.status_code == 401

    def test_sync_for_fresh_user_keeps_trialing(self, api, fresh_user):
        token, user, _ = fresh_user
        r = api.post(
            f"{BASE_URL}/api/revenuecat/sync",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, f"sync failed: {r.status_code} {r.text}"
        out = r.json()
        # No purchases yet => RC returns no entitlement; user should remain trialing
        assert out["email"] == user["email"]
        assert "pro" in out
        assert out["pro"]["plan"] == "trialing", (
            f"expected trialing after empty RC sync, got {out['pro']['plan']}"
        )
        assert out["pro"]["is_pro"] is True

    def test_sync_response_shape_is_userout(self, api, existing_user_token):
        r = api.post(
            f"{BASE_URL}/api/revenuecat/sync",
            headers={"Authorization": f"Bearer {existing_user_token}"},
        )
        assert r.status_code == 200
        body = r.json()
        for key in ("user_id", "name", "email", "provider", "pro"):
            assert key in body, f"missing {key} in UserOut response"
        for key in ("plan", "is_pro", "has_used_trial"):
            assert key in body["pro"], f"missing pro.{key}"


# =====================================================================
# 3. RevenueCat webhook
# =====================================================================
class TestRevenueCatWebhook:
    def test_webhook_no_auth_returns_401(self, api):
        r = api.post(
            f"{BASE_URL}/api/webhooks/revenuecat",
            json={"event": {"type": "INITIAL_PURCHASE", "app_user_id": "user_abc"}},
        )
        assert r.status_code == 401

    def test_webhook_wrong_token_returns_401(self, api):
        r = api.post(
            f"{BASE_URL}/api/webhooks/revenuecat",
            headers={"Authorization": "Bearer wrong_token_value"},
            json={"event": {"type": "INITIAL_PURCHASE", "app_user_id": "user_abc"}},
        )
        assert r.status_code == 401

    def test_webhook_valid_token_returns_ok(self, api, fresh_user):
        _, user, _ = fresh_user
        r = api.post(
            f"{BASE_URL}/api/webhooks/revenuecat",
            headers={"Authorization": f"Bearer {WEBHOOK_TOKEN}"},
            json={
                "event": {
                    "type": "INITIAL_PURCHASE",
                    "app_user_id": user["user_id"],
                }
            },
        )
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ok"

    def test_webhook_missing_app_user_id_ignored(self, api):
        r = api.post(
            f"{BASE_URL}/api/webhooks/revenuecat",
            headers={"Authorization": f"Bearer {WEBHOOK_TOKEN}"},
            json={"event": {"type": "TEST_EVENT"}},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ignored"

    def test_webhook_empty_body_does_not_crash(self, api):
        r = api.post(
            f"{BASE_URL}/api/webhooks/revenuecat",
            headers={"Authorization": f"Bearer {WEBHOOK_TOKEN}"},
            data="not json",
        )
        # Should not 500
        assert r.status_code in (200, 400, 422)


# =====================================================================
# 4. Dev grant-pro fallback (web)
# =====================================================================
class TestDevGrantPro:
    def test_grant_pro_requires_auth(self, api):
        r = api.post(f"{BASE_URL}/api/dev/grant-pro", json={"plan": "lifetime"})
        assert r.status_code == 401

    def test_grant_lifetime(self, api, fresh_user):
        token, _, _ = fresh_user
        r = api.post(
            f"{BASE_URL}/api/dev/grant-pro",
            headers={"Authorization": f"Bearer {token}"},
            json={"plan": "lifetime"},
        )
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["pro"]["plan"] == "lifetime"
        assert out["pro"]["is_pro"] is True
        assert out["pro"]["current_period_end"] in (None, "")

    def test_grant_monthly_sets_period_31d(self, api, fresh_user):
        token, _, _ = fresh_user
        r = api.post(
            f"{BASE_URL}/api/dev/grant-pro",
            headers={"Authorization": f"Bearer {token}"},
            json={"plan": "monthly"},
        )
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["pro"]["plan"] == "active_monthly"
        assert out["pro"]["is_pro"] is True
        cpe = out["pro"]["current_period_end"]
        assert cpe, "current_period_end must be set"
        end = datetime.fromisoformat(cpe.replace("Z", "+00:00"))
        days = (end - datetime.now(timezone.utc)).days
        assert 29 <= days <= 32, f"expected ~31 days, got {days}"

    def test_grant_yearly_sets_period_366d(self, api, fresh_user):
        token, _, _ = fresh_user
        r = api.post(
            f"{BASE_URL}/api/dev/grant-pro",
            headers={"Authorization": f"Bearer {token}"},
            json={"plan": "yearly"},
        )
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["pro"]["plan"] == "active_yearly"
        assert out["pro"]["is_pro"] is True
        cpe = out["pro"]["current_period_end"]
        assert cpe
        end = datetime.fromisoformat(cpe.replace("Z", "+00:00"))
        days = (end - datetime.now(timezone.utc)).days
        assert 364 <= days <= 367, f"expected ~366 days, got {days}"

    def test_grant_invalid_plan_422(self, api, fresh_user):
        token, _, _ = fresh_user
        r = api.post(
            f"{BASE_URL}/api/dev/grant-pro",
            headers={"Authorization": f"Bearer {token}"},
            json={"plan": "platinum"},
        )
        assert r.status_code in (400, 422)

    def test_grant_persists_via_me(self, api, fresh_user):
        token, _, _ = fresh_user
        api.post(
            f"{BASE_URL}/api/dev/grant-pro",
            headers={"Authorization": f"Bearer {token}"},
            json={"plan": "lifetime"},
        )
        r = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        assert r.json()["pro"]["plan"] == "lifetime"
        assert r.json()["pro"]["is_pro"] is True


# =====================================================================
# 5. Stripe endpoints removed
# =====================================================================
class TestStripeRemoved:
    def test_stripe_checkout_404(self, api, existing_user_token):
        r = api.post(
            f"{BASE_URL}/api/stripe/checkout",
            headers={"Authorization": f"Bearer {existing_user_token}"},
            json={"plan": "monthly"},
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}"

    def test_stripe_webhook_404(self, api):
        r = api.post(f"{BASE_URL}/api/stripe/webhook", json={})
        assert r.status_code == 404, f"expected 404, got {r.status_code}"

    def test_stripe_confirm_stub_404(self, api, existing_user_token):
        # iter2 used to have /stripe/confirm-stub — must also be gone
        r = api.post(
            f"{BASE_URL}/api/stripe/confirm-stub",
            headers={"Authorization": f"Bearer {existing_user_token}"},
            json={"plan": "monthly"},
        )
        assert r.status_code == 404


# =====================================================================
# 6. Pricing endpoint unchanged
# =====================================================================
class TestPricing:
    def test_pricing_shape(self, api):
        r = api.get(f"{BASE_URL}/api/pricing")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "prices_eur" in data
        assert "trial_hours" in data
        assert data["trial_hours"] == 48
        for k in ("monthly", "yearly", "lifetime"):
            assert k in data["prices_eur"], f"missing pricing.{k}"
            assert "amount_eur" in data["prices_eur"][k]
