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
  store_name: string | null;
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
  household_member_id: number | null;
  household_member_name: string | null;
  created_at: string;
  ingredients: MealPlanIngredient[];
}

export interface RecipeIngredient {
  id: number;
  ingredient_name: string;
  quantity: number;
  unit: string | null;
  catalog_item_id: number | null;
  unit_id: number | null;
  quantity_in_base_units: number | null;
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
  household_member_id: number | null;
  on_hand_quantities: IngredientOnHandInput[];
}

export type UpdateMealPlanEntryInput = Pick<
  CreateMealPlanEntryInput,
  "recipe_id" | "meal_slot" | "household_member_id" | "on_hand_quantities"
>;

export interface HouseholdMember {
  id: number;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export type UnitDimension = "volume" | "mass" | "count";

export interface Unit {
  id: number;
  code: string;
  display_name: string;
  dimension: UnitDimension;
  base_quantity: number;
}

export interface Store {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateRecipeIngredientInput {
  catalog_item_id: number;
  quantity: number;
  unit_id: number;
}

export interface CreateRecipeInput {
  name: string;
  instructions: string | null;
  ingredients: CreateRecipeIngredientInput[];
}

export type CatalogItemType = "food" | "household";

export interface CatalogItem {
  id: number;
  name: string;
  item_type: CatalogItemType;
  category: string | null;
  default_unit: string | null;
  is_active: boolean;
  created_at: string;
  measurement_dimension: UnitDimension | null;
  base_unit_id: number | null;
  purchase_unit_id: number | null;
  purchase_quantity: number | null;
  store_id: number | null;
  store_name: string | null;
  recipe_unit_ids: number[];
}

export interface CreateCatalogItemInput {
  name: string;
  item_type: CatalogItemType;
  category: string | null;
  measurement_dimension: UnitDimension | null;
  base_unit_id: number | null;
  purchase_unit_id: number | null;
  purchase_quantity: number | null;
  store_id: number | null;
  recipe_unit_ids: number[];
}

export type UpdateCatalogItemInput = Partial<
  Pick<
    CatalogItem,
    | "name"
    | "item_type"
    | "category"
    | "is_active"
    | "measurement_dimension"
    | "base_unit_id"
    | "purchase_unit_id"
    | "purchase_quantity"
    | "store_id"
    | "recipe_unit_ids"
  >
>;
