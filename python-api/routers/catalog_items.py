from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator

from auth import require_login
from database import get_db_connection

router = APIRouter(prefix="/catalog-items", tags=["catalog items"])


class CatalogItemResponse(BaseModel):
    id: int
    name: str
    item_type: Literal["food", "household"]
    category: str | None
    is_active: bool
    created_at: datetime

class CatalogItemCreate(BaseModel):
    name: str
    item_type: Literal["food", "household"] = "food"
    category: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized_value = value.strip()

        if not normalized_value:
            raise ValueError("Name cannot be blank.")

        return normalized_value

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str | None) -> str | None:
        if value is None:
            return None

        return value.strip() or None

class CatalogItemUpdate(BaseModel):
    name: str | None = None
    item_type: Literal["food", "household"] | None = None
    category: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized_value = value.strip()

        if not normalized_value:
            raise ValueError("Name cannot be blank.")

        return normalized_value

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str | None) -> str | None:
        if value is None:
            return None

        return value.strip() or None

@router.get("", response_model=list[CatalogItemResponse])
def list_catalog_items(
    include_inactive: bool = Query(default=False),
    item_type: Literal["food", "household"] | None = Query(default=None),
    search: str | None = Query(default=None),
    _username: str = Depends(require_login),
):
    search_pattern = (
        f"%{search.strip()}%"
        if search and search.strip()
        else None
    )

    with get_db_connection() as connection:
        result = connection.execute(
            """
            SELECT
                id,
                name,
                item_type,
                category,
                is_active,
                created_at
            FROM catalog_items
            WHERE (%s::boolean = TRUE OR is_active = TRUE)
              AND (%s::text IS NULL OR item_type = %s)
              AND (%s::text IS NULL OR name ILIKE %s)
            ORDER BY item_type, name
            """,
            (
                include_inactive,
                item_type,
                item_type,
                search_pattern,
                search_pattern,
            ),
        )

        return result.fetchall()

@router.post(
    "",
    response_model=CatalogItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_catalog_item(
    item: CatalogItemCreate,
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        result = connection.execute(
            """
            INSERT INTO catalog_items (
                name,
                item_type,
                category
            )
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING
                id,
                name,
                item_type,
                category,
                is_active,
                created_at
            """,
            (item.name, item.item_type, item.category),
        )
        created_item = result.fetchone()

        if created_item is None:
            raise HTTPException(
                status_code=409,
                detail="A catalog item with that name already exists.",
            )

        return created_item

@router.patch("/{item_id}", response_model=CatalogItemResponse)
def update_catalog_item(
    item_id: int,
    item: CatalogItemUpdate,
    _username: str = Depends(require_login),
):
    fields_to_update = item.model_fields_set

    if not fields_to_update:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one field to update.",
        )

    with get_db_connection() as connection:
        if "name" in fields_to_update:
            if item.name is None:
                raise HTTPException(
                    status_code=422,
                    detail="Name cannot be null.",
                )

            duplicate_result = connection.execute(
                """
                SELECT id
                FROM catalog_items
                WHERE lower(btrim(name)) = lower(btrim(%s))
                  AND id <> %s
                """,
                (item.name, item_id),
            )

            if duplicate_result.fetchone() is not None:
                raise HTTPException(
                    status_code=409,
                    detail="A catalog item with that name already exists.",
                )

        set_clauses: list[str] = []
        parameters: list[object] = []

        if "name" in fields_to_update:
            set_clauses.append("name = %s")
            parameters.append(item.name)

        if "item_type" in fields_to_update:
            if item.item_type is None:
                raise HTTPException(
                    status_code=422,
                    detail="Item type cannot be null.",
                )

            set_clauses.append("item_type = %s")
            parameters.append(item.item_type)

        if "category" in fields_to_update:
            set_clauses.append("category = %s")
            parameters.append(item.category)

        if "is_active" in fields_to_update:
            if item.is_active is None:
                raise HTTPException(
                    status_code=422,
                    detail="Active status cannot be null.",
                )

            set_clauses.append("is_active = %s")
            parameters.append(item.is_active)

        parameters.append(item_id)

        result = connection.execute(
            f"""
            UPDATE catalog_items
            SET {", ".join(set_clauses)}
            WHERE id = %s
            RETURNING
                id,
                name,
                item_type,
                category,
                is_active,
                created_at
            """,
            tuple(parameters),
        )
        updated_item = result.fetchone()

        if updated_item is None:
            raise HTTPException(status_code=404, detail="Catalog item not found.")

        return updated_item
