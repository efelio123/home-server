from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from auth import require_login
from database import get_db_connection

router = APIRouter(prefix="/notes", tags=["notes"])

class NoteCreate(BaseModel):
    body: str
    
@router.get("")
def list_notes(username: str = Depends(require_login)):
    with get_db_connection() as connection:
        result = connection.execute(
            "SELECT id, body, created_at FROM notes ORDER BY created_at DESC"
        )
        return result.fetchall()

@router.post("", status_code=status.HTTP_201_CREATED)
def create_note(note: NoteCreate, _username: str = Depends(require_login)):
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