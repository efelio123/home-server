from datetime import date, datetime
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth import require_login
from database import get_db_connection

router = APIRouter(prefix="/meal-plan-entries", tags=["meal plan"])

class IngredientOnHandInput(BaseModel):
    recipe_ingredient_id: int
    quantity_on_hand: float = Field(ge=0)

class MealPlanEntryCreate(BaseModel):
    recipe_id: int
    planned_for: date
    meal_slot: Literal["breakfast", "lunch", "dinner"] = "dinner"
    on_hand_quantities: list[IngredientOnHandInput] = Field(
        default_factory=list
    )

class MealPlanIngredientResponse(BaseModel):
    id: int
    ingredient_name: str
    quantity: float
    unit: str | None
    quantity_on_hand: float

class ShoppingListUpdateResponse(BaseModel):
    id: int
    item_name: str
    quantity: float
    unit: str | None

class MealPlanEntryResponse(BaseModel):
    id: int
    recipe_id: int
    planned_for: date
    meal_slot: str
    created_at: datetime
    ingredients: list[MealPlanIngredientResponse]
    shopping_list_updates: list[ShoppingListUpdateResponse]

@router.post("", response_model=MealPlanEntryResponse, status_code=status.HTTP_201_CREATED)
def create_meal_plan_entry(
    entry: MealPlanEntryCreate,
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        recipe_result = connection.execute(
            """
            SELECT id
            FROM recipes
            WHERE id = %s
            """,
            (entry.recipe_id,),
        )
        recipe = recipe_result.fetchone()

        if recipe is None:
            raise HTTPException(status_code=404, detail="Recipe not found.")

        recipe_ingredients_result = connection.execute(
            """
            SELECT
                id,
                ingredient_name,
                quantity,
                unit
            FROM recipe_ingredients
            WHERE recipe_id = %s
            ORDER BY id
            """,
            (entry.recipe_id,),
        )
        recipe_ingredients = recipe_ingredients_result.fetchall()

        on_hand_by_ingredient_id: dict[int, float] = {}

        for on_hand in entry.on_hand_quantities:
            if on_hand.recipe_ingredient_id in on_hand_by_ingredient_id:
                raise HTTPException(
                    status_code=422,
                    detail="Each recipe ingredient can appear only once.",
                )

            on_hand_by_ingredient_id[on_hand.recipe_ingredient_id] = (
                on_hand.quantity_on_hand
            )

        recipe_ingredient_ids = {
            ingredient["id"] for ingredient in recipe_ingredients
        }

        unknown_ingredient_ids = (
            on_hand_by_ingredient_id.keys() - recipe_ingredient_ids
        )

        if unknown_ingredient_ids:
            raise HTTPException(
                status_code=422,
                detail="An on-hand quantity does not belong to this recipe.",
            )

        for ingredient in recipe_ingredients:
            required_quantity = float(ingredient["quantity"])
            quantity_on_hand = on_hand_by_ingredient_id.get(
                ingredient["id"],
                0,
            )

            if quantity_on_hand > required_quantity:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"On-hand quantity for "
                        f"{ingredient['ingredient_name']} "
                        f"cannot exceed the recipe quantity."
                    ),
                )

        entry_result = connection.execute(
            """
            INSERT INTO meal_plan_entries (
                recipe_id,
                planned_for,
                meal_slot
            )
            VALUES (%s, %s, %s)
            RETURNING
                id,
                recipe_id,
                planned_for,
                meal_slot,
                created_at
            """,
            (entry.recipe_id, entry.planned_for, entry.meal_slot),
        )
        created_entry = entry_result.fetchone()

        snapshot_ingredients = []
        shopping_list_updates = []

        for ingredient in recipe_ingredients:
            required_quantity = float(ingredient["quantity"])
            quantity_on_hand = on_hand_by_ingredient_id.get(
                ingredient["id"],
                0,
            )

            snapshot_result = connection.execute(
                """
                INSERT INTO meal_plan_entry_ingredients (
                    meal_plan_entry_id,
                    ingredient_name,
                    quantity,
                    unit,
                    quantity_on_hand
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING
                    id,
                    ingredient_name,
                    quantity,
                    unit,
                    quantity_on_hand
                """,
                (
                    created_entry["id"],
                    ingredient["ingredient_name"],
                    required_quantity,
                    ingredient["unit"],
                    quantity_on_hand,
                ),
            )
            snapshot_ingredients.append(snapshot_result.fetchone())

            missing_quantity = required_quantity - quantity_on_hand

            if missing_quantity <= 0:
                continue

            existing_item_result = connection.execute(
                """
                SELECT id, quantity
                FROM shopping_list_items
                WHERE item_name = %s
                  AND unit IS NOT DISTINCT FROM %s
                  AND is_purchased = FALSE
                ORDER BY id
                LIMIT 1
                FOR UPDATE
                """,
                (ingredient["ingredient_name"], ingredient["unit"]),
            )
            existing_item = existing_item_result.fetchone()

            if existing_item is None:
                shopping_result = connection.execute(
                    """
                    INSERT INTO shopping_list_items (
                        item_name,
                        quantity,
                        unit
                    )
                    VALUES (%s, %s, %s)
                    RETURNING id, item_name, quantity, unit
                    """,
                    (
                        ingredient["ingredient_name"],
                        missing_quantity,
                        ingredient["unit"],
                    ),
                )
            else:
                shopping_result = connection.execute(
                    """
                    UPDATE shopping_list_items
                    SET quantity = quantity + %s
                    WHERE id = %s
                    RETURNING id, item_name, quantity, unit
                    """,
                    (missing_quantity, existing_item["id"]),
                )

            shopping_list_updates.append(shopping_result.fetchone())

        created_entry["ingredients"] = snapshot_ingredients
        created_entry["shopping_list_updates"] = shopping_list_updates

        return created_entry