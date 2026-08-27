import { useEffect, useMemo, useState } from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";
import { SelectButton } from "primereact/selectbutton";
import { IconField } from "primereact/iconfield";
import { InputIcon } from "primereact/inputicon";

import { CreateCatalogItemDialog } from "../components/CreateCatalogItemDialog";
import { getCatalogItems, updateCatalogItem } from "../api/client";
import type { CatalogItem, CatalogItemType } from "../api/types";
import { EditCatalogItemDialog } from "../components/EditCatalogItemDialog";

import "./PantryPage.css";

type ItemTypeFilter = "all" | CatalogItemType;
type PantryView = "table" | "categories";

const itemTypeFilterOptions = [
  { label: "All items", value: "all" },
  { label: "Food", value: "food" },
  { label: "Household", value: "household" },
];

const catalogItemTypes: CatalogItemType[] = ["food", "household"];

export function PantryPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<PantryView>("categories");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateDialogVisible, setIsCreateDialogVisible] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [archivingItemId, setArchivingItemId] = useState<number | null>(null);

  useEffect(() => {
    async function loadItems() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        setItems(
          await getCatalogItems({
            itemType: itemTypeFilter === "all" ? undefined : itemTypeFilter,
            search: search.trim() || undefined,
          }),
        );
      } catch {
        setErrorMessage("Unable to load Pantry items.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadItems();
  }, [itemTypeFilter, search, refreshVersion]);

  const groupedItems = useMemo(() => {
    const groups: Record<CatalogItemType, Record<string, CatalogItem[]>> = {
      food: {},
      household: {},
    };

    for (const item of items) {
      const category = item.category?.trim() || "Uncategorized";

      groups[item.item_type][category] ??= [];
      groups[item.item_type][category].push(item);
    }

    return groups;
  }, [items]);

  function handleCatalogItemUpdated(updatedItem: CatalogItem) {
    setItems((currentItems) => {
      if (!updatedItem.is_active) {
        return currentItems.filter((item) => item.id !== updatedItem.id);
      }

      return currentItems
        .map((item) => (item.id === updatedItem.id ? updatedItem : item))
        .sort((firstItem, secondItem) =>
          firstItem.name.localeCompare(secondItem.name),
        );
    });
  }

  async function handleArchive(item: CatalogItem) {
    const shouldArchive = window.confirm(
      `Archive "${item.name}"? It will no longer be available for new recipes or shopping-list items.`,
    );

    if (!shouldArchive) {
      return;
    }

    setArchivingItemId(item.id);

    try {
      const updatedItem = await updateCatalogItem(item.id, {
        is_active: false,
      });

      handleCatalogItemUpdated(updatedItem);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to archive this item.",
      );
    } finally {
      setArchivingItemId(null);
    }
  }

  function actionBodyTemplate(item: CatalogItem) {
    return (
      <div className="pantry-item-actions">
        <Button
          icon="pi pi-pencil"
          text
          rounded
          aria-label={`Edit ${item.name}`}
          tooltip="Edit item"
          tooltipOptions={{ position: "top" }}
          onClick={() => setEditingItem(item)}
        />

        <Button
          icon="pi pi-trash"
          text
          rounded
          severity="danger"
          aria-label={`Archive ${item.name}`}
          tooltip="Archive item"
          tooltipOptions={{ position: "top" }}
          disabled={archivingItemId === item.id}
          loading={archivingItemId === item.id}
          onClick={() => void handleArchive(item)}
        />
      </div>
    );
  }

  function purchasePackageBodyTemplate(item: CatalogItem) {
    if (item.item_type === "household") {
      return "Not applicable";
    }

    if (item.purchase_quantity === null || !item.default_unit) {
      return "Not configured";
    }

    return `${item.purchase_quantity} ${item.default_unit}`;
  }

  return (
    <section className="pantry-page">
      <div className="pantry-page__header">
        <div>
          <h1>Pantry</h1>
          <p>Manage the food and household items used across the dashboard.</p>
        </div>

        <Button
          icon="pi pi-plus"
          label="Add item"
          onClick={() => setIsCreateDialogVisible(true)}
        />
      </div>

      {errorMessage && <Message severity="error" text={errorMessage} />}

      <div className="pantry-page__filters">
        <IconField iconPosition="left" className="pantry-page__search">
          <InputIcon className="pi pi-search" />
          <InputText
            placeholder="Search Pantry items"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </IconField>

        <SelectButton
          options={itemTypeFilterOptions}
          value={itemTypeFilter}
          onChange={(event) => setItemTypeFilter(event.value as ItemTypeFilter)}
        />

        <div className="pantry-page__view-toggle">
          <Button
            aria-label="Category view"
            icon="pi pi-bars"
            outlined={view !== "categories"}
            onClick={() => setView("categories")}
          />
          <Button
            aria-label="Table view"
            icon="pi pi-table"
            outlined={view !== "table"}
            onClick={() => setView("table")}
          />
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          emptyMessage="No Pantry items found."
          loading={isLoading}
          value={items}
        >
          <Column field="name" header="Item" sortable />
          <Column field="item_type" header="Type" sortable />
          <Column field="category" header="Category" sortable />
          <Column field="store_name" header="Store" sortable />
          <Column header="Purchase package" body={purchasePackageBodyTemplate} />
          <Column
            header="Actions"
            body={actionBodyTemplate}
            style={{ width: "5rem" }}
          />
        </DataTable>
      ) : isLoading ? (
        <div className="pantry-page__loading">
          <ProgressSpinner />
        </div>
      ) : items.length === 0 ? (
        <p className="pantry-page__empty">No Pantry items found.</p>
      ) : (
        <Accordion multiple>
          {catalogItemTypes.map((itemType) => {
            const categories = Object.entries(groupedItems[itemType]).sort(
              ([first], [second]) => first.localeCompare(second),
            );

            if (categories.length === 0) {
              return null;
            }

            const itemCount = categories.reduce(
              (total, [, categoryItems]) => total + categoryItems.length,
              0,
            );

            return (
              <AccordionTab
                header={`${itemType === "food" ? "Food" : "Household"} (${itemCount})`}
                key={itemType}
              >
                <Accordion multiple>
                  {categories.map(([category, categoryItems]) => (
                    <AccordionTab
                      header={`${category} (${categoryItems.length})`}
                      key={category}
                    >
                      <ul className="pantry-category-items">
                        {[...categoryItems]
                          .sort((first, second) =>
                            first.name.localeCompare(second.name),
                          )
                          .map((item) => (
                            <li key={item.id}>
                              <div
                                className="pantry-category-item"
                                key={item.id}
                              >
                                <span>
                                  {item.name}
                                  {item.item_type === "food" && (
                                    item.purchase_quantity !== null && item.default_unit
                                      ? ` · ${item.purchase_quantity} ${item.default_unit}`
                                      : " · measurements not configured"
                                  )}
                                  {` · ${item.store_name ?? "Any store"}`}
                                </span>

                                <div className="pantry-item-actions">
                                  <Button
                                    icon="pi pi-pencil"
                                    text
                                    rounded
                                    aria-label={`Edit ${item.name}`}
                                    tooltip="Edit item"
                                    tooltipOptions={{ position: "top" }}
                                    onClick={() => setEditingItem(item)}
                                  />

                                  <Button
                                    icon="pi pi-trash"
                                    text
                                    rounded
                                    severity="danger"
                                    aria-label={`Archive ${item.name}`}
                                    tooltip="Archive item"
                                    tooltipOptions={{ position: "top" }}
                                    disabled={archivingItemId === item.id}
                                    loading={archivingItemId === item.id}
                                    onClick={() => void handleArchive(item)}
                                  />
                                </div>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </AccordionTab>
                  ))}
                </Accordion>
              </AccordionTab>
            );
          })}
        </Accordion>
      )}

      {isCreateDialogVisible && (
        <CreateCatalogItemDialog
          visible
          onHide={() => setIsCreateDialogVisible(false)}
          onCreated={() =>
            setRefreshVersion((currentVersion) => currentVersion + 1)
          }
        />
      )}
      {editingItem && (
        <EditCatalogItemDialog
          item={editingItem}
          visible
          onHide={() => setEditingItem(null)}
          onUpdated={handleCatalogItemUpdated}
        />
      )}
    </section>
  );
}

export default PantryPage;
