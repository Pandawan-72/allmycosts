"""Backend auth API tests for All My Costs."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/') if os.environ.get('EXPO_PUBLIC_BACKEND_URL') else "https://subscription-tracker-43.preview.emergentagent.com"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def fresh_user():
    suffix = uuid.uuid4().hex[:8]
    return {
        "name": "TEST User",
        "email": f"TEST_{suffix}@allmycosts.app",
        "password": "secret123",
    }


@pytest.fixture(scope="module")
def session():
    return requests.Session()


class TestRoot:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("message") == "All My Costs API"


class TestAuthRegister:
    def test_register_success(self, session, fresh_user):
        r = session.post(f"{API}/auth/register", json=fresh_user)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert "user" in data
        u = data["user"]
        assert u["email"] == fresh_user["email"].lower()
        assert u["name"] == fresh_user["name"]
        assert u["provider"] == "password"
        assert u["user_id"].startswith("user_")
        # share token for next tests
        fresh_user["_token"] = data["token"]
        fresh_user["_user_id"] = u["user_id"]

    def test_register_duplicate_email(self, session, fresh_user):
        r = session.post(f"{API}/auth/register", json={
            "name": fresh_user["name"],
            "email": fresh_user["email"],
            "password": fresh_user["password"],
        })
        assert r.status_code == 400, r.text
        assert "existe" in r.json().get("detail", "").lower() or "exist" in r.json().get("detail", "").lower()

    def test_register_invalid_email(self, session):
        r = session.post(f"{API}/auth/register", json={"name": "x", "email": "notanemail", "password": "secret123"})
        assert r.status_code == 422

    def test_register_short_password(self, session):
        r = session.post(f"{API}/auth/register", json={"name": "x", "email": f"TEST_{uuid.uuid4().hex[:6]}@x.com", "password": "abc"})
        assert r.status_code == 422


class TestAuthLogin:
    def test_login_seeded_user(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "test2@allmycosts.app", "password": "secret123"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == "test2@allmycosts.app"

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "test2@allmycosts.app", "password": "WRONGwrong"})
        assert r.status_code == 401

    def test_login_unknown_email(self, session):
        r = session.post(f"{API}/auth/login", json={"email": f"missing_{uuid.uuid4().hex[:6]}@x.com", "password": "whatever"})
        assert r.status_code == 401

    def test_login_after_register(self, session, fresh_user):
        r = session.post(f"{API}/auth/login", json={"email": fresh_user["email"], "password": fresh_user["password"]})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == fresh_user["email"].lower()


class TestAuthMe:
    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.real.jwt"})
        assert r.status_code == 401

    def test_me_with_valid_token(self, session, fresh_user):
        token = fresh_user.get("_token")
        assert token, "register test must run first"
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == fresh_user["email"].lower()
        assert u["user_id"] == fresh_user["_user_id"]


class TestAuthGoogle:
    def test_google_bad_session(self, session):
        r = session.post(f"{API}/auth/google", json={"session_id": "totally-invalid-session-xyz"})
        assert r.status_code == 401


class TestAuthLogout:
    def test_logout_requires_auth(self, session):
        r = session.post(f"{API}/auth/logout")
        assert r.status_code == 401

    def test_logout_with_token(self, session, fresh_user):
        token = fresh_user.get("_token")
        r = session.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json().get("ok") is True
