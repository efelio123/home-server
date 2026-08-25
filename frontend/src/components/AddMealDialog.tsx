import { useEffect, useState, type FormEvent } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";

import { createMealPlanEntry, getRecipe, getRecipes } from "../api/client";
import type { RecipeDetail, RecipeSummary } from "../api/types";

interface AddMealDialogProps {
  plannedFor: string;
  visible: boolean;
  onHide: () => void;
  onCreated: () => void;
}

export function AddMealDialog({
  plannedFor,
  visible,
  onHide,
  onCreated,
}: AddMealDialogProps) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(
    null,
  );
  const [quantitiesOnHand, setQuantitiesOnHand] = useState<
    Record<number, number>
  >({});
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    async function loadRecipes() {
      setIsLoadingRecipes(true);
      setErrorMessage(null);

      try {
        setRecipes(await getRecipes());
      } catch {
        setErrorMessage("Unable to load saved recipes.");
      } finally {
        setIsLoadingRecipes(false);
      }
    }

    void loadRecipes();
  }, [visible]);

  useEffect(() => {
    if (selectedRecipeId === null) {
      setSelectedRecipe(null);
      setQuantitiesOnHand({});

      return;
    }

    const recipeId = selectedRecipeId;

    async function loadSelectedRecipe() {
      setIsLoadingRecipe(true);
      setErrorMessage(null);

      try {
        const recipe = await getRecipe(recipeId);

        setSelectedRecipe(recipe);
        setQuantitiesOnHand({});
      } catch {
        setErrorMessage("Unable to load the selected recipe.");
      } finally {
        setIsLoadingRecipe(false);
      }
    }

    void loadSelectedRecipe();
  }, [selectedRecipeId]);

  function handleHide() {
    setSelectedRecipeId(null);
    setSelectedRecipe(null);
    setQuantitiesOnHand({});
    setErrorMessage(null);

    onHide();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRecipe) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createMealPlanEntry({
        recipe_id: selectedRecipe.id,
        planned_for: plannedFor,
        meal_slot: "dinner",
        on_hand_quantities: selectedRecipe.ingredients.map((ingredient) => ({
          recipe_ingredient_id: ingredient.id,
          quantity_on_hand: quantitiesOnHand[ingredient.id] ?? 0,
        })),
      });

      onCreated();
      handleHide();
    } catch (error) {
      console.error("Meal plan creation failed:", error);
      setErrorMessage("Unable to add the meal. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      header="Add meal"
      modal
      style={{ width: "min(34rem, 95vw)" }}
      visible={visible}
      onHide={handleHide}
    >
      <form onSubmit={handleSubmit}>
        {errorMessage && <Message severity="error" text={errorMessage} />}

        <div className="field">
          <label htmlFor="recipe">Saved recipe</label>
          <Dropdown
            filter
            id="recipe"
            loading={isLoadingRecipes}
            optionLabel="name"
            optionValue="id"
            options={recipes}
            placeholder="Choose a recipe"
            value={selectedRecipeId}
            onChange={(event) =>
              setSelectedRecipeId((event.value as number) ?? null)
            }
          />
        </div>

        {isLoadingRecipe && <ProgressSpinner />}

        {selectedRecipe && (
          <>
            <h3>Ingredients on hand</h3>
            <p>
              Enter what you already have. Anything missing will be added to the
              shopping list.
            </p>

            {selectedRecipe.ingredients.map((ingredient) => (
              <div className="field" key={ingredient.id}>
                <label htmlFor={`ingredient-${ingredient.id}`}>
                  {ingredient.ingredient_name} (need {ingredient.quantity}{" "}
                  {ingredient.unit ?? ""})
                </label>
                <InputNumber
                  id={`ingredient-${ingredient.id}`}
                  max={ingredient.quantity}
                  min={0}
                  minFractionDigits={0}
                  mode="decimal"
                  value={quantitiesOnHand[ingredient.id] ?? 0}
                  onValueChange={(event) =>
                    setQuantitiesOnHand((current) => ({
                      ...current,
                      [ingredient.id]: event.value ?? 0,
                    }))
                  }
                />
              </div>
            ))}
          </>
        )}

        <div className="flex justify-content-end gap-2 mt-4">
          <Button label="Cancel" outlined type="button" onClick={handleHide} />
          <Button
            disabled={!selectedRecipe || isLoadingRecipe}
            label="Add meal"
            loading={isSubmitting}
            type="submit"
          />
        </div>
      </form>
    </Dialog>
  );
}
