from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

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

class RecipeIngredientCreate(BaseModel):
    ingredient_name: str
    quantity: float
    unit: str | None = None

class RecipeCreate(BaseModel):
    name: str
    instructions: str | None = None
    ingredients: list[RecipeIngredientCreate]

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

@router.post("", response_model=RecipeDetail, status_code=status.HTTP_201_CREATED)
def add_recipe(recipe: RecipeCreate, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        recipe_result = connection.execute(
            """
            INSERT INTO recipes (
                name,
                instructions
            )
            VALUES (%s, %s)
            RETURNING
                id,
                name,
                instructions,
                created_at
            """,
            (recipe.name, recipe.instructions),
        )
        created_recipe  = recipe_result.fetchone()

        ingridient_rows = []
        for ingredient in recipe.ingredients:
            ingredient_result = connection.execute(
                """
                INSERT INTO recipe_ingredients (
                    recipe_id,
                    ingredient_name,
                    quantity,
                    unit
                )
                VALUES(%s, %s, %s, %s)
                RETURNING
                    id,
                    ingredient_name,
                    quantity,
                    unit
                """,
                (created_recipe["id"], ingredient.ingredient_name, ingredient.quantity, ingredient.unit),
            )

            ingridient_rows.append(ingredient_result.fetchone())

        created_recipe["ingredients"] = ingridient_rows

        return created_recipe