from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from auth import require_login
from database import get_db_connection
from unit_conversion import purchase_packages_needed, to_base_quantity

router = APIRouter(prefix="/meal-plan-entries", tags=["meal plan"])


class IngredientOnHandInput(BaseModel):
    recipe_ingredient_id: int
    quantity_on_hand: Decimal = Field(ge=0)


class MealPlanEntryCreate(BaseModel):
    recipe_id: int
    planned_for: date
    meal_slot: Literal["breakfast", "lunch", "dinner"] = "dinner"
    household_member_id: int | None = None
    on_hand_quantities: list[IngredientOnHandInput] = Field(default_factory=list)


class MealPlanEntryUpdate(BaseModel):
    recipe_id: int
    meal_slot: Literal["breakfast", "lunch", "dinner"]
    household_member_id: int | None = None
    on_hand_quantities: list[IngredientOnHandInput] = Field(default_factory=list)


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
    household_member_id: int | None
    created_at: datetime
    ingredients: list[MealPlanIngredientResponse]
    shopping_list_updates: list[ShoppingListUpdateResponse]


class MealPlanEntryListItem(BaseModel):
    id: int
    recipe_id: int
    recipe_name: str
    planned_for: date
    meal_slot: str
    household_member_id: int | None
    household_member_name: str | None
    created_at: datetime
    ingredients: list[MealPlanIngredientResponse]


def validate_household_member(connection, member_id: int | None):
    if member_id is None:
        return
    member = connection.execute(
        "SELECT 1 FROM household_members WHERE id = %s AND is_active = TRUE",
        (member_id,),
    ).fetchone()
    if member is None:
        raise HTTPException(status_code=422, detail="Choose an active household member.")


def get_recipe_ingredients(connection, entry):
    if connection.execute("SELECT 1 FROM recipes WHERE id = %s", (entry.recipe_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Recipe not found.")

    ingredients = connection.execute(
        """
        SELECT
            recipe_ingredients.id,
            recipe_ingredients.catalog_item_id,
            recipe_ingredients.ingredient_name,
            recipe_ingredients.quantity,
            recipe_ingredients.unit,
            recipe_ingredients.unit_id,
            recipe_ingredients.quantity_in_base_units,
            selected_unit.base_quantity AS selected_unit_quantity,
            base_unit.base_quantity AS base_unit_quantity,
            catalog_items.purchase_quantity,
            purchase_unit.display_name AS purchase_unit_name,
            purchase_unit.base_quantity AS purchase_unit_quantity,
            catalog_items.category
        FROM recipe_ingredients
        LEFT JOIN catalog_items
          ON catalog_items.id = recipe_ingredients.catalog_item_id
        LEFT JOIN units AS selected_unit
          ON selected_unit.id = recipe_ingredients.unit_id
        LEFT JOIN units AS base_unit
          ON base_unit.id = catalog_items.base_unit_id
        LEFT JOIN units AS purchase_unit
          ON purchase_unit.id = catalog_items.purchase_unit_id
        WHERE recipe_ingredients.recipe_id = %s
        ORDER BY recipe_ingredients.id
        """,
        (entry.recipe_id,),
    ).fetchall()

    on_hand_by_id = {}
    for on_hand in entry.on_hand_quantities:
        if on_hand.recipe_ingredient_id in on_hand_by_id:
            raise HTTPException(status_code=422, detail="Each recipe ingredient can appear only once.")
        on_hand_by_id[on_hand.recipe_ingredient_id] = on_hand.quantity_on_hand

    ingredient_ids = {ingredient["id"] for ingredient in ingredients}
    if on_hand_by_id.keys() - ingredient_ids:
        raise HTTPException(status_code=422, detail="An on-hand quantity does not belong to this recipe.")

    for ingredient in ingredients:
        if any(ingredient[key] is None for key in (
            "catalog_item_id", "unit_id", "quantity_in_base_units",
            "selected_unit_quantity", "base_unit_quantity", "purchase_quantity",
            "purchase_unit_name", "purchase_unit_quantity",
        )):
            raise HTTPException(
                status_code=422,
                detail=f"Configure measurement units for {ingredient['ingredient_name']} before planning this recipe.",
            )
        if on_hand_by_id.get(ingredient["id"], Decimal("0")) > ingredient["quantity"]:
            raise HTTPException(
                status_code=422,
                detail=f"On-hand quantity for {ingredient['ingredient_name']} cannot exceed the recipe quantity.",
            )
    return ingredients, on_hand_by_id


def add_ingredients_and_shopping_contributions(
    connection,
    meal_plan_entry_id: int,
    ingredients,
    on_hand_by_id,
):
    snapshots = []
    shopping_updates = []
    for ingredient in ingredients:
        on_hand = on_hand_by_id.get(ingredient["id"], Decimal("0"))
        on_hand_in_base = to_base_quantity(
            on_hand,
            ingredient["selected_unit_quantity"],
            ingredient["base_unit_quantity"],
        )
        snapshots.append(connection.execute(
            """
            INSERT INTO meal_plan_entry_ingredients (
                meal_plan_entry_id, catalog_item_id, ingredient_name, quantity,
                unit, quantity_on_hand, unit_id, quantity_in_base_units,
                quantity_on_hand_in_base_units
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, ingredient_name, quantity, unit, quantity_on_hand
            """,
            (
                meal_plan_entry_id, ingredient["catalog_item_id"],
                ingredient["ingredient_name"], ingredient["quantity"],
                ingredient["unit"], on_hand, ingredient["unit_id"],
                ingredient["quantity_in_base_units"], on_hand_in_base,
            ),
        ).fetchone())

        missing_in_base = ingredient["quantity_in_base_units"] - on_hand_in_base
        if missing_in_base <= 0:
            continue
        purchase_unit_in_base = to_base_quantity(
            ingredient["purchase_unit_quantity"],
            Decimal("1"),
            ingredient["base_unit_quantity"],
        )
        package_count = purchase_packages_needed(
            missing_in_base,
            ingredient["purchase_quantity"],
            purchase_unit_in_base,
        )
        shopping_quantity = Decimal(package_count) * ingredient["purchase_quantity"]
        shopping_item = connection.execute(
            """
            SELECT id FROM shopping_list_items
            WHERE catalog_item_id = %s
              AND unit IS NOT DISTINCT FROM %s
              AND is_purchased = FALSE
            ORDER BY id LIMIT 1 FOR UPDATE
            """,
            (ingredient["catalog_item_id"], ingredient["purchase_unit_name"]),
        ).fetchone()
        if shopping_item is None:
            shopping_item = connection.execute(
                """
                INSERT INTO shopping_list_items (
                    catalog_item_id, item_name, quantity, unit, category
                ) VALUES (%s, %s, %s, %s, %s)
                RETURNING id, item_name, quantity, unit
                """,
                (
                    ingredient["catalog_item_id"], ingredient["ingredient_name"],
                    shopping_quantity, ingredient["purchase_unit_name"], ingredient["category"],
                ),
            ).fetchone()
        else:
            shopping_item = connection.execute(
                """
                UPDATE shopping_list_items SET quantity = quantity + %s
                WHERE id = %s RETURNING id, item_name, quantity, unit
                """,
                (shopping_quantity, shopping_item["id"]),
            ).fetchone()
        connection.execute(
            """
            INSERT INTO meal_plan_shopping_list_contributions (
                meal_plan_entry_id, shopping_list_item_id, quantity
            ) VALUES (%s, %s, %s)
            """,
            (meal_plan_entry_id, shopping_item["id"], shopping_quantity),
        )
        shopping_updates.append(shopping_item)
    return snapshots, shopping_updates


def reconcile_shopping_contributions(connection, entry_id: int):
    contributions = connection.execute(
        """
        SELECT contributions.id, contributions.quantity,
               shopping_list_items.id AS shopping_list_item_id,
               shopping_list_items.quantity AS shopping_list_quantity,
               shopping_list_items.is_purchased
        FROM meal_plan_shopping_list_contributions AS contributions
        JOIN shopping_list_items
          ON shopping_list_items.id = contributions.shopping_list_item_id
        WHERE contributions.meal_plan_entry_id = %s
        FOR UPDATE OF shopping_list_items
        """,
        (entry_id,),
    ).fetchall()
    for contribution in contributions:
        connection.execute(
            "DELETE FROM meal_plan_shopping_list_contributions WHERE id = %s",
            (contribution["id"],),
        )
        if contribution["is_purchased"] or contribution["shopping_list_quantity"] < contribution["quantity"]:
            continue
        if contribution["shopping_list_quantity"] == contribution["quantity"]:
            connection.execute("DELETE FROM shopping_list_items WHERE id = %s", (contribution["shopping_list_item_id"],))
        else:
            connection.execute(
                "UPDATE shopping_list_items SET quantity = quantity - %s WHERE id = %s",
                (contribution["quantity"], contribution["shopping_list_item_id"]),
            )


def save_entry_ingredients(connection, entry_id: int, entry):
    ingredients, on_hand = get_recipe_ingredients(connection, entry)
    return add_ingredients_and_shopping_contributions(connection, entry_id, ingredients, on_hand)


@router.post("", response_model=MealPlanEntryResponse, status_code=status.HTTP_201_CREATED)
def create_meal_plan_entry(entry: MealPlanEntryCreate, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        validate_household_member(connection, entry.household_member_id)
        ingredients, on_hand = get_recipe_ingredients(connection, entry)
        created = connection.execute(
            """
            INSERT INTO meal_plan_entries (recipe_id, planned_for, meal_slot, household_member_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id, recipe_id, planned_for, meal_slot, household_member_id, created_at
            """,
            (entry.recipe_id, entry.planned_for, entry.meal_slot, entry.household_member_id),
        ).fetchone()
        created["ingredients"], created["shopping_list_updates"] = add_ingredients_and_shopping_contributions(
            connection, created["id"], ingredients, on_hand,
        )
        return created


@router.patch("/{entry_id}", response_model=MealPlanEntryResponse)
def update_meal_plan_entry(entry_id: int, entry: MealPlanEntryUpdate, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        existing = connection.execute("SELECT 1 FROM meal_plan_entries WHERE id = %s", (entry_id,)).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Meal plan entry not found.")
        validate_household_member(connection, entry.household_member_id)
        ingredients, on_hand = get_recipe_ingredients(connection, entry)
        reconcile_shopping_contributions(connection, entry_id)
        connection.execute("DELETE FROM meal_plan_entry_ingredients WHERE meal_plan_entry_id = %s", (entry_id,))
        updated = connection.execute(
            """
            UPDATE meal_plan_entries
            SET recipe_id = %s, meal_slot = %s, household_member_id = %s
            WHERE id = %s
            RETURNING id, recipe_id, planned_for, meal_slot, household_member_id, created_at
            """,
            (entry.recipe_id, entry.meal_slot, entry.household_member_id, entry_id),
        ).fetchone()
        updated["ingredients"], updated["shopping_list_updates"] = add_ingredients_and_shopping_contributions(
            connection, entry_id, ingredients, on_hand,
        )
        return updated


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_plan_entry(entry_id: int, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        if connection.execute("SELECT 1 FROM meal_plan_entries WHERE id = %s", (entry_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Meal plan entry not found.")
        reconcile_shopping_contributions(connection, entry_id)
        connection.execute("DELETE FROM meal_plan_entries WHERE id = %s", (entry_id,))


@router.get("", response_model=list[MealPlanEntryListItem])
def list_meal_plan_entries(start_date: date = Query(), _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        entries = connection.execute(
            """
            SELECT meal_plan_entries.id, meal_plan_entries.recipe_id,
                   recipes.name AS recipe_name, meal_plan_entries.planned_for,
                   meal_plan_entries.meal_slot, meal_plan_entries.household_member_id,
                   household_members.display_name AS household_member_name,
                   meal_plan_entries.created_at
            FROM meal_plan_entries
            JOIN recipes ON recipes.id = meal_plan_entries.recipe_id
            LEFT JOIN household_members ON household_members.id = meal_plan_entries.household_member_id
            WHERE meal_plan_entries.planned_for >= %s
              AND meal_plan_entries.planned_for < %s
            ORDER BY meal_plan_entries.planned_for,
                CASE meal_plan_entries.meal_slot WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 END,
                household_members.display_name NULLS FIRST
            """,
            (start_date, start_date + timedelta(days=7)),
        ).fetchall()
        for entry in entries:
            entry["ingredients"] = connection.execute(
                """
                SELECT id, ingredient_name, quantity, unit, quantity_on_hand
                FROM meal_plan_entry_ingredients
                WHERE meal_plan_entry_id = %s ORDER BY id
                """,
                (entry["id"],),
            ).fetchall()
        return entries
