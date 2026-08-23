import type { Chore, ShoppingListItem } from './types';

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

async function apiRequest<T>(path: string): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new ApiError(
            response.status,
            `API request failed with status ${response.status}.`,
        );
    }

    return response.json() as Promise<T>;
}

export function getOpenChores(): Promise<Chore[]> {
    return apiRequest<Chore[]>('/chores?status=open');
}

export function getShoppingListItems(): Promise<ShoppingListItem[]> {
    return apiRequest<ShoppingListItem[]>('/shopping-list-items');
}