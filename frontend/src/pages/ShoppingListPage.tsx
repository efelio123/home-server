import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  clearShoppingList,
  createShoppingListItem,
  deleteShoppingListItem,
  getShoppingListItems,
  updateShoppingListItemPurchaseState,
} from "../api/client";
import type { ShoppingListItem } from "../api/types";
import DashboardCard from "../components/DashboardCard";
import "./ShoppingListPage.css";

function formatQuantity(item: ShoppingListItem) {
  return item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity);
}

function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const loadShoppingListItems = useCallback(async () => {
      setLoadError(null);

      try {
        const loadedItems = await getShoppingListItems(true);
        setItems(loadedItems);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setLoadError("Your session has expired. Please sign in again.");
        } else {
          setLoadError("Unable to load the shopping list.");
        }
      }
    }, []);

  useEffect(() => {
    async function loadInitialShoppingListItems() {
      try {
        setItems(await getShoppingListItems(true));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setLoadError("Your session has expired. Please sign in again.");
        } else {
          setLoadError("Unable to load the shopping list.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadInitialShoppingListItems();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await createShoppingListItem({
        item_name: String(formData.get("item_name") ?? ""),
        quantity: Number(formData.get("quantity")),
        unit: String(formData.get("unit") ?? "").trim() || null,
        category: String(formData.get("category") ?? "").trim() || null,
      });

      form.reset();
      await loadShoppingListItems();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSubmitError("Your session has expired. Please sign in again.");
      } else {
        setSubmitError(
          "Unable to add this item. Check the form and try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePurchaseToggle(
    item: ShoppingListItem,
    isPurchased: boolean,
  ) {
    setActionError(null);
    setActiveItemId(item.id);

    try {
      await updateShoppingListItemPurchaseState(item.id, isPurchased);
      await loadShoppingListItems();
    } catch {
      setActionError("Unable to update this item. Please try again.");
    } finally {
      setActiveItemId(null);
    }
  }

  async function handleDelete(item: ShoppingListItem) {
    setActionError(null);
    setActiveItemId(item.id);

    try {
      await deleteShoppingListItem(item.id);
      await loadShoppingListItems();
    } catch {
      setActionError("Unable to delete this item. Please try again.");
    } finally {
      setActiveItemId(null);
    }
  }

  async function handleClearList() {
    const confirmed = window.confirm(
      "Clear every item from the shopping list? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setActionError(null);
    setIsClearing(true);

    try {
      await clearShoppingList();
      await loadShoppingListItems();
    } catch {
      setActionError("Unable to clear the shopping list. Please try again.");
    } finally {
      setIsClearing(false);
    }
  }

  const isPerformingItemAction = activeItemId !== null;

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

            <label htmlFor="unit">
              Unit <span>(optional)</span>
            </label>
            <input
              id="unit"
              name="unit"
              maxLength={30}
              placeholder="bag, gallon, each"
            />

            <label htmlFor="category">
              Category <span>(optional)</span>
            </label>
            <input
              id="category"
              name="category"
              maxLength={60}
              placeholder="Produce, Pantry…"
            />

            {submitError && (
              <p className="shopping-list-form__error" role="alert">
                {submitError}
              </p>
            )}

            <button type="submit" disabled={isSubmitting || isClearing}>
              {isSubmitting ? "Adding…" : "Add item"}
            </button>
          </form>
        </DashboardCard>

        <DashboardCard title="Current list" icon="pi pi-shopping-cart">
          {!isLoading && !loadError && items.length > 0 && (
            <button
              type="button"
              className="clear-list-button"
              onClick={() => void handleClearList()}
              disabled={isClearing || isPerformingItemAction}
            >
              <i className="pi pi-trash" aria-hidden="true" />
              {isClearing ? "Clearing…" : "Clear list"}
            </button>
          )}

          {isLoading && <p>Loading shopping list…</p>}

          {!isLoading && loadError && (
            <p className="shopping-list-form__error">{loadError}</p>
          )}

          {actionError && (
            <p className="shopping-list-form__error" role="alert">
              {actionError}
            </p>
          )}

          {!isLoading && !loadError && items.length === 0 && (
            <p>Your shopping list is empty.</p>
          )}

          {!isLoading && !loadError && items.length > 0 && (
            <ul className="shopping-list-items">
              {items.map((item) => {
                const isItemBusy = activeItemId === item.id;

                return (
                  <li
                    key={item.id}
                    className={
                      item.is_purchased
                        ? "shopping-list-item shopping-list-item--purchased"
                        : "shopping-list-item"
                    }
                  >
                    <label className="shopping-list-item__label">
                      <input
                        type="checkbox"
                        checked={item.is_purchased}
                        disabled={isPerformingItemAction || isClearing}
                        onChange={(event) =>
                          void handlePurchaseToggle(item, event.target.checked)
                        }
                      />

                      <span>
                        <strong>{item.item_name}</strong>
                        <small>
                          {item.store_name ?? "Any store"} ·{" "}
                          {item.category ?? "Uncategorized"} · {formatQuantity(item)}
                        </small>
                      </span>
                    </label>

                    <button
                      type="button"
                      className="shopping-list-item__delete"
                      onClick={() => void handleDelete(item)}
                      disabled={isPerformingItemAction || isClearing}
                      aria-label={`Delete ${item.item_name}`}
                    >
                      <i
                        className={
                          isItemBusy ? "pi pi-spin pi-spinner" : "pi pi-trash"
                        }
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardCard>
      </section>
    </>
  );
}

export default ShoppingListPage;
