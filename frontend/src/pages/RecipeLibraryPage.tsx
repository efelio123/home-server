import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";

import { CreateRecipeDialog } from "../components/CreateRecipeDialog";
import { getRecipes } from "../api/client";
import type { RecipeDetail, RecipeSummary } from "../api/types";

import "./RecipeLibraryPage.css";

export function RecipeLibraryPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateDialogVisible, setIsCreateDialogVisible] = useState(false);

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
      [...current, recipe].sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
    );
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
              <p>{recipe.instructions ?? "No instructions added yet."}</p>
            </Card>
          ))}
        </div>
      )}

      <CreateRecipeDialog
        visible={isCreateDialogVisible}
        onHide={() => setIsCreateDialogVisible(false)}
        onCreated={handleRecipeCreated}
      />
    </section>
  );
}

export default RecipeLibraryPage
