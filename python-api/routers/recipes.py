from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from auth import require_login
from database import get_db_connection
from unit_conversion import to_base_quantity

router = APIRouter(prefix="/recipes", tags=["recipes"])


class RecipeSummary(BaseModel):
    id: int
    name: str
    instructions: str | None
    created_at: datetime


class RecipeIngredientResponse(BaseModel):
    id: int
    catalog_item_id: int | None
    ingredient_name: str
    quantity: float
    unit: str | None
    unit_id: int | None
    quantity_in_base_units: float | None


class RecipeDetail(RecipeSummary):
    ingredients: list[RecipeIngredientResponse]


class RecipeIngredientCreate(BaseModel):
    catalog_item_id: int
    quantity: Decimal = Field(gt=0)
    unit_id: int


class RecipeCreate(BaseModel):
    name: str
    instructions: str | None = None
    ingredients: list[RecipeIngredientCreate] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Recipe name cannot be blank.")
        return value

    @field_validator("ingredients")
    @classmethod
    def validate_unique_catalog_items(
        cls,
        ingredients: list[RecipeIngredientCreate],
    ) -> list[RecipeIngredientCreate]:
        ids = [ingredient.catalog_item_id for ingredient in ingredients]
        if len(ids) != len(set(ids)):
            raise ValueError("Each catalog item can appear only once in a recipe.")
        return ingredients


INGREDIENT_COLUMNS = """id, catalog_item_id, ingredient_name, quantity, unit,
unit_id, quantity_in_base_units"""


def load_and_validate_ingredients(connection, ingredients):
    validated = []
    for ingredient in ingredients:
        configuration = connection.execute(
            """
            SELECT
                catalog_items.id,
                catalog_items.name,
                selected_unit.display_name AS unit_name,
                selected_unit.base_quantity AS selected_unit_quantity,
                base_unit.base_quantity AS base_unit_quantity
            FROM catalog_items
            JOIN catalog_item_recipe_units
              ON catalog_item_recipe_units.catalog_item_id = catalog_items.id
             AND catalog_item_recipe_units.unit_id = %s
            JOIN units AS selected_unit
              ON selected_unit.id = catalog_item_recipe_units.unit_id
            JOIN units AS base_unit
              ON base_unit.id = catalog_items.base_unit_id
            WHERE catalog_items.id = %s
              AND catalog_items.item_type = 'food'
              AND catalog_items.is_active = TRUE
              AND selected_unit.dimension = catalog_items.measurement_dimension
              AND base_unit.dimension = catalog_items.measurement_dimension
            """,
            (ingredient.unit_id, ingredient.catalog_item_id),
        ).fetchone()
        if configuration is None:
            raise HTTPException(
                status_code=422,
                detail="Choose an allowed unit for each active food item.",
            )
        configuration["quantity"] = ingredient.quantity
        configuration["unit_id"] = ingredient.unit_id
        configuration["quantity_in_base_units"] = to_base_quantity(
            ingredient.quantity,
            configuration["selected_unit_quantity"],
            configuration["base_unit_quantity"],
        )
        validated.append(configuration)
    return validated


def insert_ingredients(connection, recipe_id: int, ingredients):
    rows = []
    for ingredient in ingredients:
        rows.append(connection.execute(
            f"""
            INSERT INTO recipe_ingredients (
                recipe_id, catalog_item_id, ingredient_name, quantity, unit,
                unit_id, quantity_in_base_units
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING {INGREDIENT_COLUMNS}
            """,
            (
                recipe_id,
                ingredient["id"],
                ingredient["name"],
                ingredient["quantity"],
                ingredient["unit_name"],
                ingredient["unit_id"],
                ingredient["quantity_in_base_units"],
            ),
        ).fetchone())
    return rows


@router.get("", response_model=list[RecipeSummary])
def list_recipes(_username: str = Depends(require_login)):
    with get_db_connection() as connection:
        return connection.execute(
            "SELECT id, name, instructions, created_at FROM recipes ORDER BY name"
        ).fetchall()


@router.get("/{recipe_id}", response_model=RecipeDetail)
def get_recipe(recipe_id: int, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        recipe = connection.execute(
            "SELECT id, name, instructions, created_at FROM recipes WHERE id = %s",
            (recipe_id,),
        ).fetchone()
        if recipe is None:
            raise HTTPException(status_code=404, detail="Recipe not found.")
        recipe["ingredients"] = connection.execute(
            f"SELECT {INGREDIENT_COLUMNS} FROM recipe_ingredients WHERE recipe_id = %s ORDER BY id",
            (recipe_id,),
        ).fetchall()
        return recipe


@router.post("", response_model=RecipeDetail, status_code=status.HTTP_201_CREATED)
def add_recipe(recipe: RecipeCreate, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        ingredients = load_and_validate_ingredients(connection, recipe.ingredients)
        created = connection.execute(
            """
            INSERT INTO recipes (name, instructions) VALUES (%s, %s)
            RETURNING id, name, instructions, created_at
            """,
            (recipe.name, recipe.instructions),
        ).fetchone()
        created["ingredients"] = insert_ingredients(connection, created["id"], ingredients)
        return created


@router.put("/{recipe_id}", response_model=RecipeDetail)
def update_recipe(recipe_id: int, recipe: RecipeCreate, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        if connection.execute("SELECT 1 FROM recipes WHERE id = %s", (recipe_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Recipe not found.")
        ingredients = load_and_validate_ingredients(connection, recipe.ingredients)
        updated = connection.execute(
            """
            UPDATE recipes SET name = %s, instructions = %s WHERE id = %s
            RETURNING id, name, instructions, created_at
            """,
            (recipe.name, recipe.instructions, recipe_id),
        ).fetchone()
        connection.execute("DELETE FROM recipe_ingredients WHERE recipe_id = %s", (recipe_id,))
        updated["ingredients"] = insert_ingredients(connection, recipe_id, ingredients)
        return updated
