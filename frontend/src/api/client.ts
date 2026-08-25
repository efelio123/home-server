import type {
    Chore,
    ShoppingListItem,
    AuthenticatedUser,
    CreateShoppingListItemInput,
    Weather,
    MealPlanEntry,
    RecipeDetail,
    RecipeSummary,
    CreateMealPlanEntryInput
} from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured.');
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
    ) {
        super(message);
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
