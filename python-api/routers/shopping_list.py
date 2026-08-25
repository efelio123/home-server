from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from pydantic import BaseModel, Field, field_validator
from typing import Literal

from auth import require_login
from database import get_db_connection

router = APIRouter(
    prefix="/shopping-list-items",
    tags=["shopping list"],
)

class ShoppingListItemCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=160)
    quantity: float = Field(default=1, gt=0)
    unit: str | None = Field(default=None, max_length=30)
    category: str | None = Field(default=None, max_length=60)

    @field_validator("item_name")
    @classmethod
    def item_name_must_not_be_blank(cls, value: str) -> str:
        cleaned_value = value.strip()

        if not cleaned_value:
            raise ValueError("item_name must not be blank")

        return cleaned_value

    @field_validator("unit", "category")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        return value.strip() or None

class ShoppingListItemResponse(BaseModel):
    id: int
    item_name: str
    quantity: float
    unit: str | None
    category: str | None
    is_purchased: bool
    purchased_at: datetime | None
    created_at: datetime
    
class ShoppingListItemPurchaseUpdate(BaseModel):
    is_purchased: bool
    
class ClearShoppingListRequest(BaseModel):
    confirmation: Literal["CLEAR"]
    
@router.get("", response_model=list[ShoppingListItemResponse])
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

@router.post("", response_model=ShoppingListItemResponse, status_code=status.HTTP_201_CREATED)
def add_shopping_list_item(item: ShoppingListItemCreate, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        result = connection.execute(
            """
            INSERT INTO shopping_list_items (
                item_name,
                quantity,
                unit,
                category
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                id,
                item_name,
                quantity,
                unit,
                category,
                is_purchased,
                purchased_at,
                created_at
            """,
            (item.item_name, item.quantity, item.unit, item.category),
        )

        return result.fetchone()

@router.patch(
    "/{item_id}",
    response_model=ShoppingListItemResponse,
)
def update_shopping_list_item_purchase_state(
    item_id: int,
    update: ShoppingListItemPurchaseUpdate,
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        result = connection.execute(
            """
            UPDATE shopping_list_items
            SET
                is_purchased = %s,
                purchased_at = CASE
                    WHEN %s then COALESCE(
                        purchased_at,
                        CURRENT_TIMESTAMP
                    )
                    ELSE NULL
                END
            WHERE id = %s
            RETURNING
                id,
                item_name,
                quantity,
                unit,
                category,
                is_purchased,
                purchased_at,
                created_at
            """,
            (update.is_purchased, update.is_purchased, item_id),            
        )

        item = result.fetchone()

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping list item not found",
        )

    return item

@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_shopping_list_item(
    item_id: int,
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        result = connection.execute(
            """
            DELETE FROM shopping_list_items
            WHERE id = %s
            RETURNING id
            """,
            (item_id,),            
        )

        deleted_item = result.fetchone()

    if deleted_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping list item not found",
        )
        
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
)
def clear_shopping_list(
    request: ClearShoppingListRequest,
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        connection.execute("DELETE FROM shopping_list_items")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
