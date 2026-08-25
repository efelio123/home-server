from fastapi import APIRouter, Depends, Query

from pydantic import BaseModel
from auth import require_login
from database import get_db_connection
from datetime import date, datetime
from typing import Literal

router = APIRouter(prefix="/chores", tags=["chores"])

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
    
@router.get("", response_model=list[ChoreResponse])
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