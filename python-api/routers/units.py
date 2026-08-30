from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from auth import require_login
from database import get_db_connection

router = APIRouter(prefix="/units", tags=["units"])


class UnitResponse(BaseModel):
    id: int
    code: str
    display_name: str
    dimension: Literal["volume", "mass", "count"]
    base_quantity: float


@router.get("", response_model=list[UnitResponse])
def list_units(
    dimension: Literal["volume", "mass", "count"] | None = Query(default=None),
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        return connection.execute(
            """
            SELECT id, code, display_name, dimension, base_quantity
            FROM units
            WHERE (%s::text IS NULL OR dimension = %s)
            ORDER BY dimension, base_quantity, display_name
            """,
            (dimension, dimension),
        ).fetchall()
