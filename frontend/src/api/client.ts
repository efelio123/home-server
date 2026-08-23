import type { Chore, ShoppingListItem, AuthenticatedUser } from './types';

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
        throw new ApiError(
            response.status,
            `API request failed with status ${response.status}.`,
        );
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

export function getShoppingListItems(): Promise<ShoppingListItem[]> {
    return apiRequest<ShoppingListItem[]>('/shopping-list-items');
}