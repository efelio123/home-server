import os
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Literal

import jwt
from dotenv import load_dotenv
from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Response, status
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
    
class ChoreResponse(BaseModel):
    id: int
    title: str
    details: str | None
    assignee_id: int | None
    assignee_name: str | None
    due_date: date | None
    status: Literal["open", "completed"]
    completed_at: datetime | None
    created_at: datetime

class ShoppingListItemResponse(BaseModel):
    id: int
    item_name: str
    quantity: float
    unit: str | None
    category: str | None
    is_purchased: bool
    purchased_at: datetime | None
    created_at: datetime

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

@app.get("/chores", response_model=list[ChoreResponse])
def list_chores(
    chore_status: Literal["open", "completed"] | None = Query(
        default=None,
        alias="status"
    ),
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        result = connection.execute(
            """
            SELECT
                chores.id,
                chores.title,
                chores.details,
                chores.assignee_id,
                household_members.display_name AS assignee_name,
                chores.due_date,
                chores.status,
                chores.completed_at,
                chores.created_at
            FROM chores
            LEFT JOIN household_members
                ON household_members.id = chores.assignee_id
            WHERE (%s::text IS NULL OR chores.status = %s)
            ORDER BY
                (chores.status = 'completed'),
                chores.due_date NULLS LAST,
                chores.id
            """,
            (chore_status, chore_status)
        )
        
        return result.fetchall()

@app.get("/shopping-list-items", response_model=list[ShoppingListItemResponse])
def list_shopping_items(
    include_purchased: bool = Query(default=False),
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        result = connection.execute(
            """
            SELECT
                shopping_list_items.id,
                shopping_list_items.item_name,
                shopping_list_items.quantity,
                shopping_list_items.unit,
                shopping_list_items.category,
                shopping_list_items.is_purchased,
                shopping_list_items.purchased_at,
                shopping_list_items.created_at
            FROM shopping_list_items
            WHERE (%s OR shopping_list_items.is_purchased = FALSE)
            ORDER BY
                shopping_list_items.is_purchased,
                shopping_list_items.category NULLS LAST,
                shopping_list_items.item_name,
                shopping_list_items.id
            """,
            (include_purchased,)
        )

        return result.fetchall()

app.mount("/", StaticFiles(directory="static", html=True), name="static")