from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
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


class CatalogShoppingListItemCreate(BaseModel):
    catalog_item_id: int
    quantity: float = Field(gt=0)


class MealUsageResponse(BaseModel):
    planned_for: date
    recipe_name: str


class ShoppingListItemResponse(BaseModel):
    id: int
    item_name: str
    quantity: float
    unit: str | None
    category: str | None
    store_name: str | None = None
    meal_usage_count: int = 0
    meal_usages: list[MealUsageResponse] = Field(default_factory=list)
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
                stores.name AS store_name,
                (
                    SELECT COUNT(*)
                    FROM meal_plan_entry_ingredients
                    WHERE meal_plan_entry_ingredients.catalog_item_id
                        = shopping_list_items.catalog_item_id
                )::int AS meal_usage_count,
                COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'planned_for', meal_plan_entries.planned_for,
                            'recipe_name', recipes.name
                        )
                        ORDER BY meal_plan_entries.planned_for, recipes.name
                    )
                    FROM meal_plan_entry_ingredients
                    JOIN meal_plan_entries
                        ON meal_plan_entries.id = meal_plan_entry_ingredients.meal_plan_entry_id
                    JOIN recipes
                        ON recipes.id = meal_plan_entries.recipe_id
                    WHERE meal_plan_entry_ingredients.catalog_item_id
                        = shopping_list_items.catalog_item_id
                ), '[]'::jsonb) AS meal_usages,
                shopping_list_items.is_purchased,
                shopping_list_items.purchased_at,
                shopping_list_items.created_at
            FROM shopping_list_items
            LEFT JOIN catalog_items
                ON catalog_items.id = shopping_list_items.catalog_item_id
            LEFT JOIN stores
                ON stores.id = catalog_items.store_id
            WHERE (%s OR shopping_list_items.is_purchased = FALSE)
            ORDER BY
                shopping_list_items.is_purchased,
                stores.name NULLS LAST,
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


@router.post("/from-catalog", response_model=ShoppingListItemResponse, status_code=status.HTTP_201_CREATED)
def add_catalog_item_to_shopping_list(
    item: CatalogShoppingListItemCreate,
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        catalog_item = connection.execute(
            """
            SELECT id, name, category, default_unit
            FROM catalog_items
            WHERE id = %s AND is_active = TRUE
            """,
            (item.catalog_item_id,),
        ).fetchone()
        if catalog_item is None:
            raise HTTPException(status_code=422, detail="Choose an active Pantry item.")

        existing = connection.execute(
            """
            SELECT id
            FROM shopping_list_items
            WHERE catalog_item_id = %s
              AND unit IS NOT DISTINCT FROM %s
              AND is_purchased = FALSE
            ORDER BY id
            LIMIT 1
            FOR UPDATE
            """,
            (catalog_item["id"], catalog_item["default_unit"]),
        ).fetchone()
        if existing is None:
            result = connection.execute(
                """
                INSERT INTO shopping_list_items (
                    catalog_item_id, item_name, quantity, unit, category
                ) VALUES (%s, %s, %s, %s, %s)
                RETURNING id, item_name, quantity, unit, category,
                          is_purchased, purchased_at, created_at
                """,
                (
                    catalog_item["id"],
                    catalog_item["name"],
                    item.quantity,
                    catalog_item["default_unit"],
                    catalog_item["category"],
                ),
            )
        else:
            result = connection.execute(
                """
                UPDATE shopping_list_items
                SET quantity = quantity + %s
                WHERE id = %s
                RETURNING id, item_name, quantity, unit, category,
                          is_purchased, purchased_at, created_at
                """,
                (item.quantity, existing["id"]),
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
        connection.execute(
            "DELETE FROM meal_plan_shopping_list_contributions WHERE shopping_list_item_id = %s",
            (item_id,),
        )
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
        connection.execute("DELETE FROM meal_plan_shopping_list_contributions")
        connection.execute("DELETE FROM shopping_list_items")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
