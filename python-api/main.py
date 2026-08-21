import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from psycopg import connect
from psycopg.rows import dict_row
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from pwdlib import PasswordHash

load_dotenv()

app = FastAPI(title="Home Server API")

password_hash = PasswordHash.recommended()
session_cookie_name = "home_server_session"
session_duration = timedelta(days=7)


class NoteCreate(BaseModel):
    body: str

class LoginRequest(BaseModel):
    username: str
    password: str

def get_db_connection():
    return connect(
        host=os.environ["DB_HOST"],
        port=os.environ["DB_PORT"],
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        row_factory=dict_row,
    )

def require_login(
    session_token: str | None = Cookie(default=None, alias=session_cookie_name),
):
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(
            session_token,
            os.environ["APP_SESSION_SECRET"],
            algorithms=["HS256"]
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Not Authenticated")

    if payload.get("sub") != os.environ["APP_USERNAME"]:
        raise HTTPException(status_code=401, detail="Not Authenticated")

    return payload["sub"]

@app.post("/login")
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
        raise HTTPException(status_code=401, detail="Invalid username or password")

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

@app.post("/logout")
def logout(response: Response):
    response.delete_cookie(session_cookie_name)
    return {"status": "logged out"}

@app.get("/health")
def health_check():
    with get_db_connection() as connection:
        connection.execute("SELECT 1")

    return {"status": "ok"}

@app.get("/me")
def current_user(username: str = Depends(require_login)):
    return {"username": username}

@app.get("/notes")
def list_notes(username: str = Depends(require_login)):
    with get_db_connection() as connection:
        result = connection.execute(
            "SELECT id, body, created_at FROM notes ORDER BY created_at DESC"
        )
        return result.fetchall()

@app.post("/notes", status_code=status.HTTP_201_CREATED)
def create_note(note: NoteCreate, username: str = Depends(require_login)):
    with get_db_connection() as connection:
        result = connection.execute(
            """
            INSERT INTO notes (body)
            VALUES (%s)
            RETURNING id, body, created_at
            """,
            (note.body,),
        )

        return result.fetchone()


app.mount("/", StaticFiles(directory="static", html=True), name="static")