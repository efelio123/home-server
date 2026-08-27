import { useEffect, useState, type FormEvent } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { FloatLabel } from "primereact/floatlabel";
import { Message } from "primereact/message";
import { CreateCatalogItemDialog } from "./CreateCatalogItemDialog";
import { createRecipe, getCatalogItems, getUnits, updateRecipe } from "../api/client";
import type { CatalogItem, RecipeDetail, Unit } from "../api/types";

interface IngredientDraft {
  key: number;
  catalogItemId: number | null;
  quantity: number | null;
  unitId: number | null;
}

interface CreateRecipeDialogProps {
  visible: boolean;
  onHide: () => void;
  onCreated: (recipe: RecipeDetail) => void;
  recipeToEdit?: RecipeDetail;
}

const initialIngredient: IngredientDraft = {
  key: 1,
  catalogItemId: null,
  quantity: 1,
  unitId: null,
};

export function CreateRecipeDialog({
  visible,
  onHide,
  onCreated,
  recipeToEdit,
}: CreateRecipeDialogProps) {
  const [name, setName] = useState(recipeToEdit?.name ?? "");
  const [instructions, setInstructions] = useState(recipeToEdit?.instructions ?? "");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    recipeToEdit?.ingredients.map((ingredient, index) => ({
      key: index + 1,
      catalogItemId: ingredient.catalog_item_id,
      quantity: ingredient.quantity,
      unitId: ingredient.unit_id,
    })) ?? [initialIngredient],
  );
  const [nextIngredientKey, setNextIngredientKey] = useState(
    (recipeToEdit?.ingredients.length ?? 1) + 1,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [foodItems, setFoodItems] = useState<CatalogItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoadingFoodItems, setIsLoadingFoodItems] = useState(false);
  const [isCreateCatalogItemVisible, setIsCreateCatalogItemVisible] =
    useState(false);
  const [catalogItemRowKey, setCatalogItemRowKey] = useState<number | null>(
    null,
  );
  const [catalogItemInitialName, setCatalogItemInitialName] = useState("");
  const [ingredientFilterText, setIngredientFilterText] = useState<
    Record<number, string>
  >({});

  useEffect(() => {
    if (!visible) {
      return;
    }

    async function loadFoodItems() {
      setIsLoadingFoodItems(true);

      try {
        const [loadedFoodItems, loadedUnits] = await Promise.all([
          getCatalogItems({ itemType: "food" }),
          getUnits(),
        ]);
        setFoodItems(loadedFoodItems);
        setUnits(loadedUnits);
      } catch {
        setErrorMessage("Unable to load food items from the Pantry.");
      } finally {
        setIsLoadingFoodItems(false);
      }
    }

    void loadFoodItems();
  }, [visible]);

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
        catalogItemId: null,
        quantity: 1,
        unitId: null,
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

  function handleCatalogItemCreated(item: CatalogItem) {
    setFoodItems((current) =>
      [...current, item].sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
    );

    if (catalogItemRowKey !== null) {
      updateIngredient(catalogItemRowKey, {
        catalogItemId: item.id,
        unitId: item.recipe_unit_ids[0] ?? null,
      });
    }

    setCatalogItemRowKey(null);
    setIsCreateCatalogItemVisible(false);
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
        ingredient.catalogItemId === null ||
        ingredient.quantity === null ||
        ingredient.quantity <= 0 ||
        ingredient.unitId === null,
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
      const input = {
        name: trimmedName,
        instructions: instructions.trim() || null,
        ingredients: ingredients.map((ingredient) => ({
          catalog_item_id: ingredient.catalogItemId ?? 0,
          quantity: ingredient.quantity ?? 0,
          unit_id: ingredient.unitId ?? 0,
        })),
      };
      const savedRecipe = recipeToEdit
        ? await updateRecipe(recipeToEdit.id, input)
        : await createRecipe(input);

      onCreated(savedRecipe);
      handleHide();
    } catch (error) {
      console.error("Recipe creation failed:", error);
      setErrorMessage("Unable to create the recipe. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCreateFoodItemDialog(ingredientKey: number, initialName = "") {
    setCatalogItemRowKey(ingredientKey);
    setCatalogItemInitialName(initialName.trim());
    setIsCreateCatalogItemVisible(true);
  }

  const selectedCatalogItemIds = new Set(
    ingredients.flatMap((ingredient) =>
      ingredient.catalogItemId === null ? [] : [ingredient.catalogItemId],
    ),
  );

  return (
    <>
      <Dialog
        header={recipeToEdit ? "Edit recipe" : "Create recipe"}
        modal
        style={{ width: "min(42rem, 95vw)" }}
        visible={visible}
        onHide={handleHide}
      >
        <form className="form-dialog" onSubmit={handleSubmit}>
          {errorMessage && <Message severity="error" text={errorMessage} />}

          <div className="form-dialog__field">
            <FloatLabel>
              <InputText
                id="recipe-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <label htmlFor="recipe-name">Recipe name</label>
            </FloatLabel>
          </div>

          <div className="form-dialog__field">
            <FloatLabel>
              <InputTextarea
                autoResize
                id="recipe-instructions"
                rows={4}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
              <label htmlFor="recipe-instructions">
                Instructions (optional)
              </label>
            </FloatLabel>
          </div>

          <div className="form-dialog__section-header">
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

          <div className="form-dialog__ingredients">
            {ingredients.map((ingredient) => {
              const selectedItem = foodItems.find(
                (item) => item.id === ingredient.catalogItemId,
              );
              const allowedUnits = units.filter((unit) =>
                selectedItem?.recipe_unit_ids.includes(unit.id),
              );
              const availableFoodItems = foodItems.filter(
                (item) =>
                  item.id === ingredient.catalogItemId ||
                  !selectedCatalogItemIds.has(item.id),
              );

              return (
                <div
                  className="form-dialog__ingredient-row"
                  key={ingredient.key}
                >
                  <div className="form-dialog__ingredient-field">
                    <FloatLabel>
                      <Dropdown
                        filter
                        inputId={`ingredient-item-${ingredient.key}`}
                        loading={isLoadingFoodItems}
                        optionLabel="name"
                        optionValue="id"
                        options={availableFoodItems}
                        value={ingredient.catalogItemId}
                        onFilter={(event) => {
                          setIngredientFilterText((current) => ({
                            ...current,
                            [ingredient.key]: event.filter,
                          }));
                        }}
                        panelFooterTemplate={(_props, hide) => (
                          <div className="form-dialog__dropdown-footer">
                            <Button
                              label="Create a new food item"
                              icon="pi pi-plus"
                              outlined
                              size="small"
                              type="button"
                              onClick={() => {
                                hide();
                                openCreateFoodItemDialog(
                                  ingredient.key,
                                  ingredientFilterText[ingredient.key] ?? "",
                                );
                              }}
                            />
                          </div>
                        )}
                        onChange={(event) => {
                          const catalogItemId = (event.value as number) ?? null;
                          const item = foodItems.find(
                            (foodItem) => foodItem.id === catalogItemId,
                          );
                          updateIngredient(ingredient.key, {
                            catalogItemId,
                            unitId: item?.recipe_unit_ids[0] ?? null,
                          });
                        }}
                      />
                      <label htmlFor={`ingredient-item-${ingredient.key}`}>
                        Ingredient
                      </label>
                    </FloatLabel>
                  </div>

                  <div className="form-dialog__ingredient-field">
                    <FloatLabel>
                      <Dropdown
                        inputId={`ingredient-unit-${ingredient.key}`}
                        disabled={!selectedItem}
                        optionLabel="display_name"
                        optionValue="id"
                        options={allowedUnits}
                        value={ingredient.unitId}
                        onChange={(event) =>
                          updateIngredient(ingredient.key, {
                            unitId: (event.value as number) ?? null,
                          })
                        }
                      />
                      <label htmlFor={`ingredient-unit-${ingredient.key}`}>
                        Unit
                      </label>
                    </FloatLabel>
                  </div>

                  <div className="form-dialog__ingredient-field">
                    <FloatLabel>
                      <InputNumber
                        inputId={`ingredient-quantity-${ingredient.key}`}
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
                      <label htmlFor={`ingredient-quantity-${ingredient.key}`}>
                        Quantity
                      </label>
                    </FloatLabel>
                  </div>

                  <Button
                    aria-label="Remove ingredient"
                    disabled={ingredients.length === 1}
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    type="button"
                    onClick={() => removeIngredient(ingredient.key)}
                  />
                </div>
              );
            })}
          </div>

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
              label={recipeToEdit ? "Save changes" : "Create recipe"}
              icon="pi pi-check"
              loading={isSubmitting}
              type="submit"
            />
          </div>
        </form>
      </Dialog>

      {isCreateCatalogItemVisible && (
        <CreateCatalogItemDialog
          fixedItemType="food"
          initialName={catalogItemInitialName}
          visible
          onHide={() => {
            setIsCreateCatalogItemVisible(false);
            setCatalogItemInitialName("");
          }}
          onCreated={handleCatalogItemCreated}
        />
      )}
    </>
  );
}
