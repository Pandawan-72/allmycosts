"""Pricing, trial and Stripe stub tests for All My Costs (iteration 2)."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = (os.environ.get('EXPO_PUBLIC_BACKEND_URL')
            or "https://subscription-tracker-43.preview.emergentagent.com").rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    return requests.Session()


@pytest.fixture(scope="module")
def fresh_user(session):
    """Register a brand-new user; share token across tests."""
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "name": "TEST Pro",
        "email": f"TEST_pro_{suffix}@allmycosts.app",
        "password": "secret123",
    }
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return {**payload, "token": data["token"], "user": data["user"]}


# ---------- Pricing endpoint ----------
class TestPricing:
    def test_pricing_shape(self, session):
        r = session.get(f"{API}/pricing")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("trial_hours") == 48
        prices = body.get("prices_eur")
        assert isinstance(prices, dict)
        for k in ("monthly", "yearly", "lifetime"):
            assert k in prices, f"missing plan {k}"
            assert "amount_cents" in prices[k]
        # Exact amounts per spec
        assert prices["monthly"]["amount_cents"] == 299
        assert prices["yearly"]["amount_cents"] == 2388
        assert prices["lifetime"]["amount_cents"] == 6900
        # Intervals
        assert prices["monthly"]["interval"] == "month"
        assert prices["yearly"]["interval"] == "year"
        assert prices["lifetime"]["interval"] is None


# ---------- Auto-trial on register ----------
class TestAutoTrial:
    def test_register_starts_trial(self, fresh_user):
        u = fresh_user["user"]
        assert "pro" in u, "user payload must include pro object"
        pro = u["pro"]
        assert pro["plan"] == "trialing"
        assert pro["is_pro"] is True
        assert pro.get("has_used_trial") is True
        assert pro.get("trial_end"), "trial_end must be set"
        # trial_end ~48h ahead (allow generous skew)
        te = datetime.fromisoformat(pro["trial_end"])
        now = datetime.now(timezone.utc)
        delta_hours = (te - now).total_seconds() / 3600.0
        assert 47.0 < delta_hours < 49.0, f"trial_end should be ~48h ahead, got {delta_hours}h"

    def test_me_returns_pro(self, session, fresh_user):
        r = session.get(f"{API}/auth/me",
                        headers={"Authorization": f"Bearer {fresh_user['token']}"})
        assert r.status_code == 200, r.text
        u = r.json()
        assert "pro" in u
        assert u["pro"]["plan"] == "trialing"
        assert u["pro"]["is_pro"] is True


# ---------- Stripe checkout (stub mode) ----------
class TestStripeCheckout:
    def test_checkout_requires_auth(self, session):
        r = session.post(f"{API}/stripe/checkout", json={
            "plan": "monthly",
            "success_url": "https://x/ok",
            "cancel_url": "https://x/cancel",
        })
        assert r.status_code == 401

    @pytest.mark.parametrize("plan", ["monthly", "yearly", "lifetime"])
    def test_checkout_stub(self, session, fresh_user, plan):
        r = session.post(f"{API}/stripe/checkout",
                         headers={"Authorization": f"Bearer {fresh_user['token']}"},
                         json={"plan": plan,
                               "success_url": "https://x/ok",
                               "cancel_url": "https://x/cancel"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and isinstance(body["url"], str) and len(body["url"]) > 0
        # In stub mode (sk_test_emergent) it must be flagged stub:true
        assert body.get("stub") is True, "expected stub mode in this env"
        assert plan in body["url"]

    def test_checkout_invalid_plan(self, session, fresh_user):
        r = session.post(f"{API}/stripe/checkout",
                         headers={"Authorization": f"Bearer {fresh_user['token']}"},
                         json={"plan": "bogus",
                               "success_url": "https://x/ok",
                               "cancel_url": "https://x/cancel"})
        assert r.status_code == 422


# ---------- Stripe confirm-stub (mark user pro) ----------
class TestStripeConfirmStub:
    def test_confirm_lifetime_requires_auth(self, session):
        r = session.post(f"{API}/stripe/confirm-stub", json={"plan": "lifetime"})
        assert r.status_code == 401

    def test_confirm_lifetime_updates_user(self, session, fresh_user):
        r = session.post(f"{API}/stripe/confirm-stub",
                         headers={"Authorization": f"Bearer {fresh_user['token']}"},
                         json={"plan": "lifetime"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["pro"]["plan"] == "lifetime"
        assert body["pro"]["is_pro"] is True
        # Verify via GET /auth/me (persistence)
        r2 = session.get(f"{API}/auth/me",
                         headers={"Authorization": f"Bearer {fresh_user['token']}"})
        assert r2.status_code == 200
        assert r2.json()["pro"]["plan"] == "lifetime"

    def test_confirm_invalid_plan(self, session, fresh_user):
        r = session.post(f"{API}/stripe/confirm-stub",
                         headers={"Authorization": f"Bearer {fresh_user['token']}"},
                         json={"plan": "garbage"})
        assert r.status_code == 400

    def test_confirm_monthly_then_yearly(self, session):
        # Need a separate user since the fixture user is now lifetime
        suffix = uuid.uuid4().hex[:6]
        reg = session.post(f"{API}/auth/register", json={
            "name": "TEST Sub", "email": f"TEST_sub_{suffix}@allmycosts.app",
            "password": "secret123",
        })
        assert reg.status_code == 200
        tok = reg.json()["token"]
        hdr = {"Authorization": f"Bearer {tok}"}

        r1 = session.post(f"{API}/stripe/confirm-stub", headers=hdr,
                          json={"plan": "monthly"})
        assert r1.status_code == 200
        assert r1.json()["pro"]["plan"] == "active_monthly"

        r2 = session.post(f"{API}/stripe/confirm-stub", headers=hdr,
                          json={"plan": "yearly"})
        assert r2.status_code == 200
        assert r2.json()["pro"]["plan"] == "active_yearly"
