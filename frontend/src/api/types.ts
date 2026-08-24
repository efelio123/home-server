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