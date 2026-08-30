import { Button } from "primereact/button";
import { Card } from "primereact/card";

import "./RecipeExplorePage.css";

const exploreOptions = [
  {
    title: "Available Recipes",
    description: "See what you can make for dinner based on what items you have at home.",
  },
  {
    title: "Explore Recipes",
    description: "Give me a list of ingredients, and I'll find suggestions for new meals to try.",
  },
];

export function RecipeExplorePage() {
  return (
    <section className="recipe-explore-page">
      <div>
        <h1>Explore Recipes</h1>
      </div>

      <div className="recipe-explore-page__grid">
        {exploreOptions.map((option) => (
          <Card key={option.title} title={option.title} className="recipe-explore-card">
            <div className="recipe-explore-card__content">
              <p>{option.description}</p>
              <Button label="Coming Soon" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default RecipeExplorePage;
