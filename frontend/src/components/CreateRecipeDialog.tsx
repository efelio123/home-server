import { useState, type FormEvent } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";

import { createRecipe } from "../api/client";
import type { RecipeDetail } from "../api/types";

interface IngredientDraft {
  key: number;
  ingredientName: string;
  quantity: number | null;
  unit: string;
}

interface CreateRecipeDialogProps {
  visible: boolean;
  onHide: () => void;
  onCreated: (recipe: RecipeDetail) => void;
}

const initialIngredient: IngredientDraft = {
  key: 1,
  ingredientName: "",
  quantity: 1,
  unit: "",
};

export function CreateRecipeDialog({
  visible,
  onHide,
  onCreated,
}: CreateRecipeDialogProps) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    initialIngredient,
  ]);
  const [nextIngredientKey, setNextIngredientKey] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setInstructions("");
    setIngredients([initialIngredient]);
    setNextIngredientKey(2);
    setErrorMessage(null);
  }

  function handleHide() {
    resetForm();
    onHide();
  }

  function addIngredient() {
    setIngredients((current) => [
      ...current,
      {
        key: nextIngredientKey,
        ingredientName: "",
        quantity: 1,
        unit: "",
      },
    ]);
    setNextIngredientKey((current) => current + 1);
  }

  function removeIngredient(ingredientKey: number) {
    setIngredients((current) =>
      current.filter((ingredient) => ingredient.key !== ingredientKey),
    );
  }

  function updateIngredient(
    ingredientKey: number,
    changes: Partial<IngredientDraft>,
  ) {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.key === ingredientKey
          ? { ...ingredient, ...changes }
          : ingredient,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMessage("A recipe name is required.");

      return;
    }

    if (ingredients.length === 0) {
      setErrorMessage("Add at least one ingredient.");

      return;
    }

    const hasInvalidIngredient = ingredients.some(
      (ingredient) =>
        !ingredient.ingredientName.trim() ||
        ingredient.quantity === null ||
        ingredient.quantity <= 0,
    );

    if (hasInvalidIngredient) {
      setErrorMessage(
        "Every ingredient needs a name and a quantity greater than zero.",
      );

      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const createdRecipe = await createRecipe({
        name: trimmedName,
        instructions: instructions.trim() || null,
        ingredients: ingredients.map((ingredient) => ({
          ingredient_name: ingredient.ingredientName.trim(),
          quantity: ingredient.quantity ?? 0,
          unit: ingredient.unit.trim() || null,
        })),
      });

      onCreated(createdRecipe);
      handleHide();
    } catch {
      setErrorMessage("Unable to create the recipe. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      header="Create recipe"
      modal
      style={{ width: "min(42rem, 95vw)" }}
      visible={visible}
      onHide={handleHide}
    >
      <form onSubmit={handleSubmit}>
        {errorMessage && <Message severity="error" text={errorMessage} />}

        <div className="field">
          <label htmlFor="recipe-name">Recipe name</label>
          <InputText
            id="recipe-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="recipe-instructions">Instructions</label>
          <InputTextarea
            autoResize
            id="recipe-instructions"
            rows={4}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </div>

        <div className="flex align-items-center justify-content-between">
          <h3>Ingredients</h3>
          <Button
            icon="pi pi-plus"
            label="Add ingredient"
            outlined
            size="small"
            type="button"
            onClick={addIngredient}
          />
        </div>

        {ingredients.map((ingredient) => (
          <div
            className="flex align-items-end gap-2 mb-3"
            key={ingredient.key}
          >
            <div className="field flex-1 mb-0">
              <label htmlFor={`ingredient-name-${ingredient.key}`}>
                Ingredient
              </label>
              <InputText
                id={`ingredient-name-${ingredient.key}`}
                value={ingredient.ingredientName}
                onChange={(event) =>
                  updateIngredient(ingredient.key, {
                    ingredientName: event.target.value,
                  })
                }
              />
            </div>

            <div className="field mb-0">
              <label htmlFor={`ingredient-quantity-${ingredient.key}`}>
                Quantity
              </label>
              <InputNumber
                id={`ingredient-quantity-${ingredient.key}`}
                maxFractionDigits={2}
                min={0.01}
                mode="decimal"
                value={ingredient.quantity}
                onValueChange={(event) =>
                  updateIngredient(ingredient.key, {
                    quantity: event.value,
                  })
                }
              />
            </div>

            <div className="field mb-0">
              <label htmlFor={`ingredient-unit-${ingredient.key}`}>Unit</label>
              <InputText
                id={`ingredient-unit-${ingredient.key}`}
                value={ingredient.unit}
                onChange={(event) =>
                  updateIngredient(ingredient.key, {
                    unit: event.target.value,
                  })
                }
              />
            </div>

            <Button
              aria-label={`Remove ${ingredient.ingredientName || "ingredient"}`}
              disabled={ingredients.length === 1}
              icon="pi pi-trash"
              severity="danger"
              text
              type="button"
              onClick={() => removeIngredient(ingredient.key)}
            />
          </div>
        ))}

        <div className="flex justify-content-end gap-2 mt-4">
          <Button
            label="Cancel"
            outlined
            type="button"
            onClick={handleHide}
          />
          <Button label="Create recipe" loading={isSubmitting} type="submit" />
        </div>
      </form>
    </Dialog>
  );
}
