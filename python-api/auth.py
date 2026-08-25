import os

import jwt
from fastapi import Cookie, HTTPException

session_cookie_name = "home_server_session"


def require_login(
    session_token: str | None = Cookie(
        default=None,
        alias=session_cookie_name,
    ),
):
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(
            session_token,
            os.environ["APP_SESSION_SECRET"],
            algorithms=["HS256"],
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if payload.get("sub") != os.environ["APP_USERNAME"]:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return payload["sub"]