import { useCallback, useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";
import { Message } from "primereact/message";
import { Tooltip } from "primereact/tooltip";

import {
  addCatalogItemToShoppingList,
  ApiError,
  clearShoppingList,
  deleteShoppingListItem,
  getCatalogItems,
  getShoppingListItems,
  updateShoppingListItemPurchaseState,
} from "../api/client";
import { CreateCatalogItemDialog } from "../components/CreateCatalogItemDialog";
import DashboardCard from "../components/DashboardCard";
import type { CatalogItem, ShoppingListItem } from "../api/types";
import "./ShoppingListPage.css";

function formatQuantity(item: ShoppingListItem) {
  return item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity);
}

function formatPlannedFor(plannedFor: string) {
  const plannedDate = new Date(`${plannedFor}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (plannedDate.getTime() === today.getTime()) {
    return "Today";
  }
  if (plannedDate.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }
  return plannedDate.toLocaleDateString(undefined, { weekday: "long" });
}

function formatMealUsage(item: ShoppingListItem) {
  return `Used in ${item.meal_usage_count} ${item.meal_usage_count === 1 ? "meal" : "meals"}`;
}

function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<
    number | null
  >(null);
  const [quantityToAdd, setQuantityToAdd] = useState<number | null>(1);
  const [catalogFilterText, setCatalogFilterText] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCatalogItems, setIsLoadingCatalogItems] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isCreateCatalogItemVisible, setIsCreateCatalogItemVisible] =
    useState(false);

  const loadShoppingListItems = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await getShoppingListItems(true));
    } catch (error) {
      setLoadError(
        error instanceof ApiError && error.status === 401
          ? "Your session has expired. Please sign in again."
          : "Unable to load the shopping list.",
      );
    }
  }, []);

  useEffect(() => {
    async function loadPage() {
      try {
        const [loadedShoppingItems, loadedCatalogItems] = await Promise.all([
          getShoppingListItems(true),
          getCatalogItems(),
        ]);
        setItems(loadedShoppingItems);
        setCatalogItems(loadedCatalogItems);
      } catch (error) {
        setLoadError(
          error instanceof ApiError && error.status === 401
            ? "Your session has expired. Please sign in again."
            : "Unable to load the shopping list or Pantry items.",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingCatalogItems(false);
      }
    }

    void loadPage();
  }, []);

  async function handleAddCatalogItem() {
    if (
      selectedCatalogItemId === null ||
      quantityToAdd === null ||
      quantityToAdd <= 0
    ) {
      setAddError(
        "Choose a Pantry item and enter a quantity greater than zero.",
      );
      return;
    }

    setAddError(null);
    setIsAdding(true);
    try {
      await addCatalogItemToShoppingList({
        catalog_item_id: selectedCatalogItemId,
        quantity: quantityToAdd,
      });
      setSelectedCatalogItemId(null);
      setQuantityToAdd(1);
      await loadShoppingListItems();
    } catch (error) {
      setAddError(
        error instanceof ApiError && error.status === 401
          ? "Your session has expired. Please sign in again."
          : "Unable to add this Pantry item to the shopping list.",
      );
    } finally {
      setIsAdding(false);
    }
  }

  function handleCatalogItemCreated(item: CatalogItem) {
    setCatalogItems((current) =>
      [...current, item].sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
    );
    setSelectedCatalogItemId(item.id);
    setIsCreateCatalogItemVisible(false);
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
    if (
      !window.confirm(
        "Clear every item from the shopping list? This cannot be undone.",
      )
    ) {
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
  const storeFilterOptions = [
    { label: "All stores", value: "all" },
    { label: "Any store", value: "unassigned" },
    ...Array.from(
      new Set(
        items.flatMap((item) =>
          item.store_name === null ? [] : [item.store_name],
        ),
      ),
    )
      .sort((first, second) => first.localeCompare(second))
      .map((storeName) => ({ label: storeName, value: storeName })),
  ];
  const visibleItems = items.filter(
    (item) =>
      storeFilter === "all" ||
      (storeFilter === "unassigned" && item.store_name === null) ||
      item.store_name === storeFilter,
  );

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
        <DashboardCard title="Add Pantry item" icon="pi pi-plus">
          <div className="shopping-list-add">
            <div className="shopping-list-add__row">
              <div className="shopping-list-add__item-field">
                <FloatLabel>
                  <Dropdown
                    filter
                    inputId="shopping-catalog-item"
                    loading={isLoadingCatalogItems}
                    optionLabel="name"
                    optionValue="id"
                    options={catalogItems}
                    placeholder="Search Pantry items"
                    value={selectedCatalogItemId}
                    onFilter={(event) => setCatalogFilterText(event.filter)}
                    panelFooterTemplate={(_props, hide) => (
                      <div className="shopping-list-add__dropdown-footer">
                        <Button
                          icon="pi pi-plus"
                          label="Create a new Pantry item"
                          outlined
                          size="small"
                          type="button"
                          onClick={() => {
                            hide();
                            setIsCreateCatalogItemVisible(true);
                          }}
                        />
                      </div>
                    )}
                    onChange={(event) =>
                      setSelectedCatalogItemId((event.value as number) ?? null)
                    }
                  />
                  <label htmlFor="shopping-catalog-item">Add Pantry item</label>
                </FloatLabel>
              </div>

              <div className="shopping-list-add__quantity-field">
                <FloatLabel>
                  <InputNumber
                    inputId="shopping-catalog-quantity"
                    maxFractionDigits={0}
                    min={1}
                    minFractionDigits={0}
                    useGrouping={false}
                    value={quantityToAdd}
                    onValueChange={(event) =>
                      setQuantityToAdd(event.value ?? null)
                    }
                  />
                  <label htmlFor="shopping-catalog-quantity">Quantity</label>
                </FloatLabel>
              </div>

              <Button
                icon="pi pi-plus"
                label="Add"
                loading={isAdding}
                type="button"
                disabled={isLoadingCatalogItems}
                onClick={() => void handleAddCatalogItem()}
              />
            </div>
            {addError && <Message severity="error" text={addError} />}
          </div>
        </DashboardCard>

        <DashboardCard title="Current list" icon="pi pi-shopping-cart">
          <div className="shopping-list-list-controls">
            <div className="shopping-list-store-filter">
              <FloatLabel>
                <Dropdown
                  inputId="shopping-store-filter"
                  optionLabel="label"
                  optionValue="value"
                  options={storeFilterOptions}
                  value={storeFilter}
                  onChange={(event) => setStoreFilter(event.value as string)}
                />
                <label htmlFor="shopping-store-filter">Store</label>
              </FloatLabel>
            </div>
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
          </div>

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
          {!isLoading &&
            !loadError &&
            items.length > 0 &&
            visibleItems.length === 0 && (
              <p>No shopping-list items match this store.</p>
            )}

          {!isLoading && !loadError && visibleItems.length > 0 && (
            <ul className="shopping-list-items">
              {visibleItems.map((item) => {
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
                          {item.category ?? "Uncategorized"} ·{" "}
                          {formatQuantity(item)}
                        </small>
                        {item.meal_usage_count > 0 && (
                          <>
                            <Tooltip
                              target={`#shopping-meal-usage-${item.id}`}
                              content={item.meal_usages
                                .map((meal) => `${formatPlannedFor(meal.planned_for)} - ${meal.recipe_name}`)
                                .join("\n")}
                              className="shopping-list-item__meal-tooltip"
                            />
                            <span
                              id={`shopping-meal-usage-${item.id}`}
                              className="shopping-list-item__recipe-usage"
                              tabIndex={0}
                            >
                              <i
                                className="pi pi-info-circle"
                                aria-hidden="true"
                              />
                              {formatMealUsage(item)}
                            </span>
                          </>
                        )}
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

      {isCreateCatalogItemVisible && (
        <CreateCatalogItemDialog
          initialName={catalogFilterText}
          visible
          onHide={() => setIsCreateCatalogItemVisible(false)}
          onCreated={handleCatalogItemCreated}
        />
      )}
    </>
  );
}

export default ShoppingListPage;
