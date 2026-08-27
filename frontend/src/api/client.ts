import type {
    Chore,
    ShoppingListItem,
    AuthenticatedUser,
    CreateShoppingListItemInput,
    Weather,
    MealPlanEntry,
    RecipeDetail,
    RecipeSummary,
    CreateMealPlanEntryInput,
    UpdateMealPlanEntryInput,
    CreateRecipeInput,
    CatalogItemType,
    CatalogItem,
    CreateCatalogItemInput,
    HouseholdMember,
    Unit,
    UnitDimension,
    UpdateCatalogItemInput,
    Store,
} from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured.');
}

export class ApiError extends Error {
    readonly status: number;

    constructor(
        status: number,
        message: string,
    ) {
        super(message);
        this.status = status;
    }
}

async function apiRequest<T>(path: string, options: RequestInit = {},): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        credentials: 'include',
    });

    if (!response.ok) {
        const errorBody = await response.text();

        throw new ApiError(
            response.status, `API request failed with status ${response.status}: ${errorBody}`,
        );
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

export function getCurrentUser(): Promise<AuthenticatedUser> {
    return apiRequest<AuthenticatedUser>('/me');
}

export function login(
    username: string,
    password: string,
): Promise<AuthenticatedUser> {
    return apiRequest<AuthenticatedUser>('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });
}

export function logout(): Promise<{ status: string}> {
    return apiRequest<{ status: string }>('/logout', {
        method: 'POST',
    });
}

export function getOpenChores(): Promise<Chore[]> {
    return apiRequest<Chore[]>('/chores?status=open');
}

export function getShoppingListItems(
    includePurchased = false,
): Promise<ShoppingListItem[]> {
  const path = includePurchased
    ? '/shopping-list-items?include_purchased=true'
    : '/shopping-list-items';

    return apiRequest<ShoppingListItem[]>(path);
}

export function createShoppingListItem(
    item: CreateShoppingListItemInput,
): Promise<ShoppingListItem> {
    return apiRequest<ShoppingListItem>('/shopping-list-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(item),
  });
}

export function updateShoppingListItemPurchaseState(
    itemId: number,
    isPurchased: boolean,
): Promise<ShoppingListItem> {
  return apiRequest<ShoppingListItem>(`/shopping-list-items/${itemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_purchased: isPurchased }),
  });
}

export function deleteShoppingListItem(itemId: number): Promise<void> {
  return apiRequest<void>(`/shopping-list-items/${itemId}`, {
    method: 'DELETE',
  });
}

export function clearShoppingList(): Promise<void> {
  return apiRequest<void>('/shopping-list-items', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirmation: 'CLEAR' }),
  });
}

export function getMealPlanEntries(startDate: string) {
  return apiRequest<MealPlanEntry[]>(
    `/meal-plan-entries?start_date=${encodeURIComponent(startDate)}`,
  );
}

export function getWeather(): Promise<Weather> {
  return apiRequest<Weather>('/weather');
}

export function getRecipes() {
  return apiRequest<RecipeSummary[]>("/recipes");
}

export function getRecipe(recipeId: number) {
  return apiRequest<RecipeDetail>(`/recipes/${recipeId}`);
}

export function createMealPlanEntry(input: CreateMealPlanEntryInput) {
  return apiRequest("/meal-plan-entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function getHouseholdMembers(): Promise<HouseholdMember[]> {
  return apiRequest<HouseholdMember[]>("/household-members");
}

export function getUnits(dimension?: UnitDimension): Promise<Unit[]> {
  const path = dimension ? `/units?dimension=${dimension}` : "/units";
  return apiRequest<Unit[]>(path);
}

export function getStores(): Promise<Store[]> {
  return apiRequest<Store[]>("/stores");
}

export function createStore(name: string): Promise<Store> {
  return apiRequest<Store>("/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export function createHouseholdMember(displayName: string): Promise<HouseholdMember> {
  return apiRequest<HouseholdMember>("/household-members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  });
}

export function updateHouseholdMember(
  memberId: number,
  updates: Partial<Pick<HouseholdMember, "display_name" | "is_active">>,
): Promise<HouseholdMember> {
  return apiRequest<HouseholdMember>(`/household-members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export function updateMealPlanEntry(
  entryId: number,
  input: UpdateMealPlanEntryInput,
) {
  return apiRequest(`/meal-plan-entries/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteMealPlanEntry(entryId: number): Promise<void> {
  return apiRequest<void>(`/meal-plan-entries/${entryId}`, {
    method: "DELETE",
  });
}

export function createRecipe(input: CreateRecipeInput): Promise<RecipeDetail> {
  return apiRequest<RecipeDetail>("/recipes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function updateRecipe(
  recipeId: number,
  input: CreateRecipeInput,
): Promise<RecipeDetail> {
  return apiRequest<RecipeDetail>(`/recipes/${recipeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

interface GetCatalogItemsOptions {
  includeInactive?: boolean;
  itemType?: CatalogItemType;
  search?: string;
}

export function getCatalogItems(
  options: GetCatalogItemsOptions = {},
): Promise<CatalogItem[]> {
  const searchParameters = new URLSearchParams();

  if (options.includeInactive) {
    searchParameters.set("include_inactive", "true");
  }

  if (options.itemType) {
    searchParameters.set("item_type", options.itemType);
  }

  if (options.search) {
    searchParameters.set("search", options.search);
  }

  const query = searchParameters.toString();
  const path = query ? `/catalog-items?${query}` : "/catalog-items";

  return apiRequest<CatalogItem[]>(path);
}

export function createCatalogItem(
  input: CreateCatalogItemInput,
): Promise<CatalogItem> {
  return apiRequest<CatalogItem>("/catalog-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function updateCatalogItem(
  itemId: number,
  updates: UpdateCatalogItemInput,
): Promise<CatalogItem> {
  return apiRequest<CatalogItem>(`/catalog-items/${itemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
}
