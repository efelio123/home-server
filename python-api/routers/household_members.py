from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from auth import require_login
from database import get_db_connection

router = APIRouter(prefix="/household-members", tags=["household members"])


class HouseholdMemberResponse(BaseModel):
    id: int
    display_name: str
    is_active: bool
    created_at: datetime


class HouseholdMemberCreate(BaseModel):
    display_name: str

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Display name cannot be blank.")
        return value


class HouseholdMemberUpdate(BaseModel):
    display_name: str | None = None
    is_active: bool | None = None


@router.get("", response_model=list[HouseholdMemberResponse])
def list_household_members(
    include_inactive: bool = False,
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        return connection.execute(
            """
            SELECT id, display_name, is_active, created_at
            FROM household_members
            WHERE (%s OR is_active = TRUE)
            ORDER BY display_name
            """,
            (include_inactive,),
        ).fetchall()


@router.post("", response_model=HouseholdMemberResponse, status_code=status.HTTP_201_CREATED)
def create_household_member(
    member: HouseholdMemberCreate,
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        return connection.execute(
            """
            INSERT INTO household_members (display_name)
            VALUES (%s)
            RETURNING id, display_name, is_active, created_at
            """,
            (member.display_name,),
        ).fetchone()


@router.patch("/{member_id}", response_model=HouseholdMemberResponse)
def update_household_member(
    member_id: int,
    member: HouseholdMemberUpdate,
    _username: str = Depends(require_login),
):
    fields = member.model_fields_set
    if not fields:
        raise HTTPException(status_code=422, detail="Provide at least one field to update.")

    set_clauses = []
    parameters = []
    if "display_name" in fields:
        if member.display_name is None or not member.display_name.strip():
            raise HTTPException(status_code=422, detail="Display name cannot be blank.")
        set_clauses.append("display_name = %s")
        parameters.append(member.display_name.strip())
    if "is_active" in fields:
        if member.is_active is None:
            raise HTTPException(status_code=422, detail="Active status cannot be null.")
        set_clauses.append("is_active = %s")
        parameters.append(member.is_active)

    parameters.append(member_id)
    with get_db_connection() as connection:
        updated_member = connection.execute(
            f"""
            UPDATE household_members
            SET {", ".join(set_clauses)}
            WHERE id = %s
            RETURNING id, display_name, is_active, created_at
            """,
            tuple(parameters),
        ).fetchone()
        if updated_member is None:
            raise HTTPException(status_code=404, detail="Household member not found.")
        return updated_member
