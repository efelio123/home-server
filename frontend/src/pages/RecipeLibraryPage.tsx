import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";

import { CreateRecipeDialog } from "../components/CreateRecipeDialog";
import { archiveRecipe, getRecipe, getRecipes } from "../api/client";
import type { RecipeDetail, RecipeSummary } from "../api/types";

import "./RecipeLibraryPage.css";

export function RecipeLibraryPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateDialogVisible, setIsCreateDialogVisible] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeDetail | null>(null);
  const [archivingRecipeId, setArchivingRecipeId] = useState<number | null>(null);

  useEffect(() => {
    async function loadRecipes() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        setRecipes(await getRecipes());
      } catch {
        setErrorMessage("Unable to load saved recipes.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadRecipes();
  }, []);

  function handleRecipeCreated(recipe: RecipeDetail) {
    setRecipes((current) =>
      [...current.filter((item) => item.id !== recipe.id), recipe].sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
    );
  }

  async function handleEdit(recipeId: number) {
    try {
      setEditingRecipe(await getRecipe(recipeId));
    } catch {
      setErrorMessage("Unable to load this recipe for editing.");
    }
  }

  async function handleArchive(recipe: RecipeSummary) {
    if (!window.confirm(`Archive "${recipe.name}"? It will remain on existing meal plans but cannot be selected for new meals.`)) {
      return;
    }

    setArchivingRecipeId(recipe.id);
    setErrorMessage(null);
    try {
      await archiveRecipe(recipe.id);
      setRecipes((current) => current.filter((item) => item.id !== recipe.id));
    } catch {
      setErrorMessage("Unable to archive this recipe.");
    } finally {
      setArchivingRecipeId(null);
    }
  }

  return (
    <section className="recipe-library-page">
      <div className="recipe-library-page__header">
        <div>
          <h1>Recipe Library</h1>
          <p>Create and save meals you can add to the weekly plan.</p>
        </div>

        <Button
          icon="pi pi-plus"
          label="Create recipe"
          onClick={() => setIsCreateDialogVisible(true)}
        />
      </div>

      {errorMessage && <Message severity="error" text={errorMessage} />}

      {isLoading ? (
        <div className="recipe-library-page__loading">
          <ProgressSpinner />
        </div>
      ) : recipes.length === 0 ? (
        <Card>
          <p>No saved recipes yet. Create your first one to start planning.</p>
        </Card>
      ) : (
        <div className="recipe-library-grid">
          {recipes.map((recipe) => (
            <Card key={recipe.id} title={recipe.name}>
              <p className="recipe-library-card__instructions">{recipe.instructions ?? "No instructions added yet."}</p>
              <div className="recipe-library-card__actions">
                <Button label="Edit" icon="pi pi-pencil" outlined size="small" onClick={() => void handleEdit(recipe.id)} />
                <Button
                  label="Delete"
                  icon="pi pi-box"
                  severity="danger"
                  outlined
                  size="small"
                  loading={archivingRecipeId === recipe.id}
                  disabled={archivingRecipeId !== null}
                  onClick={() => void handleArchive(recipe)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {isCreateDialogVisible && <CreateRecipeDialog visible onHide={() => setIsCreateDialogVisible(false)} onCreated={handleRecipeCreated} />}
      {editingRecipe && <CreateRecipeDialog recipeToEdit={editingRecipe} visible onHide={() => setEditingRecipe(null)} onCreated={(recipe) => { handleRecipeCreated(recipe); setEditingRecipe(null); }} />}
    </section>
  );
}

export default RecipeLibraryPage
