from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from auth import require_login
from database import get_db_connection
from pydantic import BaseModel

router = APIRouter(prefix="/recipes", tags=["recipes"])

class RecipeSummary(BaseModel):
    id: int
    name: str
    instructions: str | None
    created_at: datetime


class RecipeIngredientResponse(BaseModel):
    id: int
    ingredient_name: str
    quantity: float
    unit: str | None


class RecipeDetail(BaseModel):
    id: int
    name: str
    instructions: str | None
    created_at: datetime
    ingredients: list[RecipeIngredientResponse]


@router.get("", response_model=list[RecipeSummary])
def list_recipes(_username: str = Depends(require_login)):
    with get_db_connection() as connection:
        result = connection.execute(
            """
            SELECT
                recipes.id,
                recipes.name,
                recipes.instructions,
                recipes.created_at
            FROM recipes
            ORDER BY recipes.name
            """
        )

        return result.fetchall()


@router.get("/{recipe_id}", response_model=RecipeDetail)
def get_recipe(
    recipe_id: int,
    _username: str = Depends(require_login),
):
    with get_db_connection() as connection:
        recipe_result = connection.execute(
            """
            SELECT
                recipes.id,
                recipes.name,
                recipes.instructions,
                recipes.created_at
            FROM recipes
            WHERE recipes.id = %s
            """,
            (recipe_id,),
        )
        recipe = recipe_result.fetchone()

        if recipe is None:
            raise HTTPException(status_code=404, detail="Recipe not found.")

        ingredients_result = connection.execute(
            """
            SELECT
                recipe_ingredients.id,
                recipe_ingredients.ingredient_name,
                recipe_ingredients.quantity,
                recipe_ingredients.unit
            FROM recipe_ingredients
            WHERE recipe_ingredients.recipe_id = %s
            ORDER BY recipe_ingredients.id
            """,
            (recipe_id,),
        )

        recipe["ingredients"] = ingredients_result.fetchall()

        return recipe