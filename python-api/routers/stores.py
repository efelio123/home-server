from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from auth import require_login
from database import get_db_connection

router = APIRouter(prefix="/stores", tags=["stores"])


class StoreResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime


class StoreCreate(BaseModel):
    name: str = Field(max_length=120)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Store name cannot be blank.")
        return value


@router.get("", response_model=list[StoreResponse])
def list_stores(_username: str = Depends(require_login)):
    with get_db_connection() as connection:
        return connection.execute(
            """
            SELECT id, name, is_active, created_at
            FROM stores
            WHERE is_active = TRUE
            ORDER BY name
            """
        ).fetchall()


@router.post("", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(store: StoreCreate, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        created = connection.execute(
            """
            INSERT INTO stores (name)
            VALUES (%s)
            ON CONFLICT DO NOTHING
            RETURNING id, name, is_active, created_at
            """,
            (store.name,),
        ).fetchone()
        if created is None:
            raise HTTPException(status_code=409, detail="A store with that name already exists.")
        return created
