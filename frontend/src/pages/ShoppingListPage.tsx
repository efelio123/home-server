import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import {
  ApiError,
  createShoppingListItem,
  getShoppingListItems,
} from '../api/client';
import type { ShoppingListItem } from '../api/types';
import DashboardCard from '../components/DashboardCard';

function formatQuantity(item: ShoppingListItem) {
  return item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity);
}

function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadShoppingListItems = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const loadedItems = await getShoppingListItems();
      setItems(loadedItems);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setLoadError('Your session has expired. Please sign in again.');
      } else {
        setLoadError('Unable to load the shopping list.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShoppingListItems();
  }, [loadShoppingListItems]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await createShoppingListItem({
        item_name: String(formData.get('item_name') ?? ''),
        quantity: Number(formData.get('quantity')),
        unit: String(formData.get('unit') ?? '').trim() || null,
        category: String(formData.get('category') ?? '').trim() || null,
      });

      form.reset();
      await loadShoppingListItems();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSubmitError('Your session has expired. Please sign in again.');
      } else {
        setSubmitError('Unable to add this item. Check the form and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <p className="page-header__eyebrow">SHARED LIST</p>
        <h1>Shopping List</h1>
        <p className="page-header__subtitle">
          Keep the household list up to date.
        </p>
      </header>

      <section className="shopping-list-page">
        <DashboardCard title="Add an item" icon="pi pi-plus">
          <form className="shopping-list-form" onSubmit={handleSubmit}>
            <label htmlFor="item_name">Item</label>
            <input id="item_name" name="item_name" required maxLength={160} />

            <label htmlFor="quantity">Quantity</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue="1"
              required
            />

            <label htmlFor="unit">Unit <span>(optional)</span></label>
            <input id="unit" name="unit" maxLength={30} placeholder="bag, gallon, each" />

            <label htmlFor="category">Category <span>(optional)</span></label>
            <input id="category" name="category" maxLength={60} placeholder="Produce, Pantry…" />

            {submitError && (
              <p className="shopping-list-form__error" role="alert">
                {submitError}
              </p>
            )}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add item'}
            </button>
          </form>
        </DashboardCard>

        <DashboardCard title="Current list" icon="pi pi-shopping-cart">
          {isLoading && <p>Loading shopping list…</p>}
          {!isLoading && loadError && (
            <p className="shopping-list-form__error">{loadError}</p>
          )}
          {!isLoading && !loadError && items.length === 0 && (
            <p>Your shopping list is empty.</p>
          )}
          {!isLoading && !loadError && items.length > 0 && (
            <ul className="dashboard-card__list">
              {items.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.item_name}</strong>
                    <span>{item.category ?? 'Uncategorized'}</span>
                  </div>
                  <span>{formatQuantity(item)}</span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </section>
    </>
  );
}

export default ShoppingListPage;