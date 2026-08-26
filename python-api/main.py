import os
import config
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
from fastapi.middleware.cors import CORSMiddleware
from pwdlib import PasswordHash
from threading import Lock
import httpx

from database import get_db_connection
from routers import auth as auth_router, recipes, shopping_list, chores, weather, notes, meal_plan, catalog_items


load_dotenv()

app = FastAPI(title="Home Server API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ["FRONTEND_ORIGIN"]],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(auth_router.router)
app.include_router(recipes.router)
app.include_router(shopping_list.router)
app.include_router(meal_plan.router)
app.include_router(catalog_items.router)
app.include_router(chores.router)
app.include_router(weather.router)
app.include_router(notes.router)

@app.get("/health")
def health_check():
    with get_db_connection() as connection:
        connection.execute("SELECT 1")

    return {"status": "ok"}



app.mount("/", StaticFiles(directory="static", html=True), name="static")
