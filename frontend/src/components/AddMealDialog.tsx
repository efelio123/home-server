import { useEffect, useState, type FormEvent } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";

import { createMealPlanEntry, getHouseholdMembers, getRecipe, getRecipes, updateMealPlanEntry } from "../api/client";
import type { HouseholdMember, MealPlanEntry, RecipeDetail, RecipeSummary } from "../api/types";
import "../styles/forms.css";
import { CreateRecipeDialog } from "./CreateRecipeDialog";

interface AddMealDialogProps {
  plannedFor: string;
  visible: boolean;
  entry?: MealPlanEntry;
  onHide: () => void;
  onCreated: () => void;
}

export function AddMealDialog({
  plannedFor,
  visible,
  entry,
  onHide,
  onCreated,
}: AddMealDialogProps) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [mealSlot, setMealSlot] = useState<"breakfast" | "lunch" | "dinner">(entry?.meal_slot as "breakfast" | "lunch" | "dinner" ?? "dinner");
  const [householdMemberId, setHouseholdMemberId] = useState<number | null>(entry?.household_member_id ?? null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(entry?.recipe_id ?? null);
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
  const [isCreateRecipeDialogVisible, setIsCreateRecipeDialogVisible] =
    useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    async function loadRecipes() {
      setIsLoadingRecipes(true);
      setErrorMessage(null);

      try {
        const [loadedRecipes, loadedMembers] = await Promise.all([getRecipes(), getHouseholdMembers()]);
        setRecipes(loadedRecipes);
        setMembers(loadedMembers);
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
      return;
    }

    const recipeId = selectedRecipeId;

    async function loadSelectedRecipe() {
      setIsLoadingRecipe(true);
      setErrorMessage(null);

      try {
        const recipe = await getRecipe(recipeId);
        setSelectedRecipe(recipe);
        const entryQuantities = new Map(
          entry?.ingredients.map((ingredient) => [
            `${ingredient.ingredient_name}\u0000${ingredient.unit ?? ""}`,
            ingredient.quantity_on_hand,
          ]),
        );
        setQuantitiesOnHand(Object.fromEntries(recipe.ingredients.map((ingredient) => [
          ingredient.id,
          entryQuantities.get(`${ingredient.ingredient_name}\u0000${ingredient.unit ?? ""}`) ?? 0,
        ])));
      } catch {
        setErrorMessage("Unable to load the selected recipe.");
      } finally {
        setIsLoadingRecipe(false);
      }
    }

    void loadSelectedRecipe();
  }, [entry, selectedRecipeId]);

  function handleHide() {
    setSelectedRecipeId(null);
    setSelectedRecipe(null);
    setQuantitiesOnHand({});
    setErrorMessage(null);
    onHide();
  }

  function handleRecipeCreated(recipe: RecipeDetail) {
    setRecipes((current) =>
      [...current, recipe].sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
    );
    setSelectedRecipeId(recipe.id);
    setSelectedRecipe(recipe);
    setQuantitiesOnHand({});
  }

  function handleRecipeSelection(recipeId: number | null) {
    setSelectedRecipeId(recipeId);
    setSelectedRecipe(null);
    setQuantitiesOnHand({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRecipe) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const input = {
        recipe_id: selectedRecipe.id,
        meal_slot: mealSlot,
        household_member_id: householdMemberId,
        on_hand_quantities: selectedRecipe.ingredients.map((ingredient) => ({
          recipe_ingredient_id: ingredient.id,
          quantity_on_hand: quantitiesOnHand[ingredient.id] ?? 0,
        })),
      };
      if (entry) {
        await updateMealPlanEntry(entry.id, input);
      } else {
        await createMealPlanEntry({ ...input, planned_for: plannedFor });
      }

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
    <>
      <Dialog
        header={entry ? "Edit meal" : "Add meal"}
        modal
        contentClassName="add-meal-dialog__content"
        style={{ width: "min(34rem, 95vw)" }}
        visible={visible}
        onHide={handleHide}
      >
        <form className="form-dialog" onSubmit={handleSubmit}>
          {errorMessage && <Message severity="error" text={errorMessage} />}

          <div className="form-dialog__field">
            <FloatLabel>
              <Dropdown
                filter
                inputId="meal-recipe"
                loading={isLoadingRecipes}
                optionLabel="name"
                optionValue="id"
                options={recipes}
                value={selectedRecipeId}
                onChange={(event) =>
                  handleRecipeSelection((event.value as number) ?? null)
                }
              />
              <label htmlFor="meal-recipe">Saved recipe</label>
            </FloatLabel>
          </div>

          <div className="form-dialog__field">
            <FloatLabel>
              <Dropdown
                inputId="meal-recipient"
                optionLabel="label"
                optionValue="value"
                options={[
                  { label: "Family", value: null },
                  ...members.map((member) => ({
                    label: member.display_name,
                    value: member.id,
                  })),
                ]}
                value={householdMemberId}
                onChange={(event) =>
                  setHouseholdMemberId(event.value as number | null)
                }
              />
              <label htmlFor="meal-recipient">For</label>
            </FloatLabel>
          </div>

          <div className="form-dialog__field">
            <FloatLabel>
              <Dropdown
                inputId="meal-slot"
                optionLabel="label"
                optionValue="value"
                options={[
                  { label: "Breakfast", value: "breakfast" },
                  { label: "Lunch", value: "lunch" },
                  { label: "Dinner", value: "dinner" },
                ]}
                value={mealSlot}
                onChange={(event) =>
                  setMealSlot(
                    event.value as "breakfast" | "lunch" | "dinner",
                  )
                }
              />
              <label htmlFor="meal-slot">Meal</label>
            </FloatLabel>
          </div>

          <div className="form-dialog__inline-action">
            <Button
              icon="pi pi-plus"
              label="Create a new recipe"
              text
              type="button"
              onClick={() => setIsCreateRecipeDialogVisible(true)}
            />
          </div>

          {isLoadingRecipe && (
            <div className="form-dialog__loading">
              <ProgressSpinner />
            </div>
          )}

          {selectedRecipe && (
            <>
              <div className="form-dialog__section-intro">
                <h3>Ingredients on hand</h3>
                <p>
                  Enter what you already have. Anything missing will be added to
                  the shopping list.
                </p>
              </div>

              <div className="form-dialog__on-hand-list">
                {selectedRecipe.ingredients.map((ingredient) => (
                  <div className="form-dialog__on-hand-row" key={ingredient.id}>
                    <div className="form-dialog__on-hand-description">
                      <strong>{ingredient.ingredient_name}</strong>
                      <span>
                        Need {ingredient.quantity} {ingredient.unit ?? ""}
                      </span>
                    </div>

                    <div className="form-dialog__on-hand-input">
                      <label
                        className="form-dialog__input-label"
                        htmlFor={`ingredient-${ingredient.id}`}
                      >
                        On hand
                      </label>

                      <InputNumber
                        inputId={`ingredient-${ingredient.id}`}
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
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="form-dialog__actions">
            <Button
              label="Cancel"
              severity="secondary"
              outlined
              type="button"
              disabled={isSubmitting}
              onClick={handleHide}
            />
            <Button
              disabled={!selectedRecipe || isLoadingRecipe}
              icon="pi pi-check"
              label={entry ? "Save changes" : "Add meal"}
              loading={isSubmitting}
              type="submit"
            />
          </div>
        </form>
      </Dialog>

      <CreateRecipeDialog
        visible={isCreateRecipeDialogVisible}
        onHide={() => setIsCreateRecipeDialogVisible(false)}
        onCreated={handleRecipeCreated}
      />
    </>
  );
}
