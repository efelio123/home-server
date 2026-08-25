import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from pwdlib import PasswordHash

from auth import require_login, session_cookie_name

router = APIRouter(tags=["authentication"])

password_hash = PasswordHash.recommended()
session_duration = timedelta(days=7)


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(credentials: LoginRequest, response: Response):
    username_matches = secrets.compare_digest(
        credentials.username,
        os.environ["APP_USERNAME"],
    )
    password_matches = password_hash.verify(
        credentials.password,
        os.environ["APP_PASSWORD_HASH"],
    )

    if not username_matches or not password_matches:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    expires_at = datetime.now(timezone.utc) + session_duration
    session_token = jwt.encode(
        {"sub": credentials.username, "exp": expires_at},
        os.environ["APP_SESSION_SECRET"],
        algorithm="HS256",
    )

    response.set_cookie(
        key=session_cookie_name,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=int(session_duration.total_seconds()),
    )

    return {"username": credentials.username}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(session_cookie_name)
    return {"status": "logged out"}


@router.get("/me")
def current_user(username: str = Depends(require_login)):
    return {"username": username}