export type Chore = {
  id: number;
  title: string;
  details: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  due_date: string | null;
  status: 'open' | 'completed';
  completed_at: string | null;
  created_at: string;
};

export type ShoppingListItem = {
  id: number;
  item_name: string;
  quantity: number;
  unit: string | null;
  category: string | null;
  is_purchased: boolean;
  purchased_at: string | null;
  created_at: string;
};

export type AuthenticatedUser = {
  username: string
}

export type CreateShoppingListItemInput = {
  item_name: string;
  quantity: number;
  unit: string | null;
  category: string | null;
}

export type Weather = {
  location_name: string;
  temperature_f: number;
  apparent_temperature_f: number;
  condition: string;
  is_day: boolean;
  today_high_f: number;
  today_low_f: number;
};

export interface MealPlanIngredient {
  id: number;
  ingredient_name: string;
  quantity: number;
  unit: string | null;
  quantity_on_hand: number;
}

export interface MealPlanEntry {
  id: number;
  recipe_id: number;
  recipe_name: string;
  planned_for: string;
  meal_slot: string;
  created_at: string;
  ingredients: MealPlanIngredient[];
}

export interface RecipeIngredient {
  id: number;
  ingredient_name: string;
  quantity: number;
  unit: string | null;
}

export interface RecipeSummary {
  id: number;
  name: string;
  instructions: string | null;
  created_at: string;
}

export interface RecipeDetail extends RecipeSummary {
  ingredients: RecipeIngredient[];
}

export interface IngredientOnHandInput {
  recipe_ingredient_id: number;
  quantity_on_hand: number;
}

export interface CreateMealPlanEntryInput {
  recipe_id: number;
  planned_for: string;
  meal_slot: "breakfast" | "lunch" | "dinner";
  on_hand_quantities: IngredientOnHandInput[];
}

export interface CreateRecipeIngredientInput {
  ingredient_name: string;
  quantity: number;
  unit: string | null;
}

export interface CreateRecipeInput {
  name: string;
  instructions: string | null;
  ingredients: CreateRecipeIngredientInput[];
}
