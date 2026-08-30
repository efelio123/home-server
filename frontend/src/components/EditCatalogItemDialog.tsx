import { useEffect, useState, type FormEvent } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { MultiSelect } from "primereact/multiselect";

import { getStores, getUnits, updateCatalogItem } from "../api/client";
import type { CatalogItem, CatalogItemType, Store, Unit, UnitDimension, UpdateCatalogItemInput } from "../api/types";
import "../styles/forms.css";
import { CreateStoreDialog } from "./CreateStoreDialog";

type Props = { item: CatalogItem; visible: boolean; onHide: () => void; onUpdated: (item: CatalogItem) => void };
const itemTypeOptions = [{ label: "Food", value: "food" }, { label: "Household", value: "household" }];
const dimensionOptions = [{ label: "Volume", value: "volume" }, { label: "Mass", value: "mass" }, { label: "Count", value: "count" }];

export function EditCatalogItemDialog({ item, visible, onHide, onUpdated }: Props) {
  const [name, setName] = useState(item.name);
  const [itemType, setItemType] = useState<CatalogItemType>(item.item_type);
  const [category, setCategory] = useState(item.category ?? "");
  const [units, setUnits] = useState<Unit[]>([]);
  const [dimension, setDimension] = useState<UnitDimension | null>(item.measurement_dimension);
  const [baseUnitId, setBaseUnitId] = useState<number | null>(item.base_unit_id);
  const [purchaseUnitId, setPurchaseUnitId] = useState<number | null>(item.purchase_unit_id);
  const [purchaseQuantity, setPurchaseQuantity] = useState<number | null>(item.purchase_quantity);
  const [recipeUnitIds, setRecipeUnitIds] = useState<number[]>(item.recipe_unit_ids);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<number | null>(item.store_id);
  const [isCreateStoreVisible, setIsCreateStoreVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    void Promise.all([getUnits(), getStores()])
      .then(([loadedUnits, loadedStores]) => {
        setUnits(loadedUnits);
        setStores(loadedStores);
      })
      .catch(() => setErrorMessage("Unable to load units or stores."));
  }, [visible]);

  function changeDimension(nextDimension: UnitDimension) {
    setDimension(nextDimension);
    setBaseUnitId(null);
    setPurchaseUnitId(null);
    setRecipeUnitIds([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hasInvalidFoodMeasurements = itemType === "food" && (
      !dimension || baseUnitId === null || purchaseUnitId === null ||
      purchaseQuantity === null || purchaseQuantity <= 0 ||
      recipeUnitIds.length === 0
    );
    if (!name.trim() || hasInvalidFoodMeasurements) {
      setErrorMessage("Complete all required measurement fields.");
      return;
    }

    const updates: UpdateCatalogItemInput = {
      name: name.trim(),
      item_type: itemType,
      category: category.trim() || null,
      store_id: storeId,
    };
    if (itemType === "food") {
      updates.measurement_dimension = dimension;
      updates.base_unit_id = baseUnitId;
      updates.purchase_unit_id = purchaseUnitId;
      updates.purchase_quantity = purchaseQuantity;
      updates.recipe_unit_ids = recipeUnitIds;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      onUpdated(await updateCatalogItem(item.id, updates));
      onHide();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update this item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    if (!window.confirm(`Archive "${item.name}"? It will no longer be available in new recipes or shopping-list items.`)) return;
    setIsSaving(true);
    try {
      onUpdated(await updateCatalogItem(item.id, { is_active: false }));
      onHide();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to archive this item.");
    } finally {
      setIsSaving(false);
    }
  }

  const compatibleUnits = units.filter((unit) => unit.dimension === dimension);
  function handleStoreCreated(store: Store) {
    setStores((current) => [...current, store].sort((first, second) => first.name.localeCompare(second.name)));
    setStoreId(store.id);
    setIsCreateStoreVisible(false);
  }

  return (
    <>
    <Dialog header="Edit Pantry item" modal style={{ width: "min(36rem, 95vw)" }} visible={visible} onHide={onHide}>
      <form className="form-dialog" onSubmit={handleSubmit}>
        {errorMessage && <Message severity="error" text={errorMessage} />}
        <div className="form-dialog__field"><FloatLabel><InputText id="edit-catalog-name" value={name} onChange={(event) => setName(event.target.value)} /><label htmlFor="edit-catalog-name">Name</label></FloatLabel></div>
        <div className="form-dialog__field"><FloatLabel><Dropdown inputId="edit-catalog-type" value={itemType} options={itemTypeOptions} optionLabel="label" optionValue="value" onChange={(event) => { const nextType = event.value as CatalogItemType; setItemType(nextType); if (nextType === "household") setRecipeUnitIds([]); }} /><label htmlFor="edit-catalog-type">Type</label></FloatLabel></div>
        <div className="form-dialog__field"><FloatLabel><InputText id="edit-catalog-category" value={category} onChange={(event) => setCategory(event.target.value)} /><label htmlFor="edit-catalog-category">Category (optional)</label></FloatLabel></div>
        <div className="form-dialog__field"><FloatLabel><Dropdown inputId="edit-catalog-store" showClear value={storeId} options={stores} optionLabel="name" optionValue="id" placeholder="Any store" panelFooterTemplate={(_props, hide) => <div className="form-dialog__dropdown-footer"><Button label="Add a new store" icon="pi pi-plus" outlined size="small" type="button" onClick={() => { hide(); setIsCreateStoreVisible(true); }} /></div>} onChange={(event) => setStoreId((event.value as number) ?? null)} /><label htmlFor="edit-catalog-store">Store (optional)</label></FloatLabel></div>
        {itemType === "food" && <>
          <div className="form-dialog__field"><FloatLabel><Dropdown inputId="edit-catalog-dimension" value={dimension} options={dimensionOptions} optionLabel="label" optionValue="value" onChange={(event) => changeDimension(event.value as UnitDimension)} /><label htmlFor="edit-catalog-dimension">Measurement type</label></FloatLabel></div>
          <div className="form-dialog__field"><FloatLabel><Dropdown inputId="edit-catalog-base-unit" disabled={!dimension} value={baseUnitId} options={compatibleUnits} optionLabel="display_name" optionValue="id" onChange={(event) => setBaseUnitId(event.value as number)} /><label htmlFor="edit-catalog-base-unit">Base unit</label></FloatLabel><small className="form-dialog__helper-text">Inventory math is stored in this unit.</small></div>
          <div className="form-dialog__measurement-row">
            <div className="form-dialog__field"><FloatLabel><InputNumber inputId="edit-catalog-purchase-quantity" maxFractionDigits={3} min={0.001} value={purchaseQuantity} onValueChange={(event) => setPurchaseQuantity(event.value ?? null)} /><label htmlFor="edit-catalog-purchase-quantity">Purchase quantity</label></FloatLabel></div>
            <div className="form-dialog__field"><FloatLabel><Dropdown inputId="edit-catalog-purchase-unit" disabled={!dimension} value={purchaseUnitId} options={compatibleUnits} optionLabel="display_name" optionValue="id" onChange={(event) => setPurchaseUnitId(event.value as number)} /><label htmlFor="edit-catalog-purchase-unit">Purchase unit</label></FloatLabel></div>
          </div>
          <div className="form-dialog__field"><FloatLabel><MultiSelect inputId="edit-catalog-recipe-units" disabled={!dimension} value={recipeUnitIds} options={compatibleUnits} optionLabel="display_name" optionValue="id" onChange={(event) => setRecipeUnitIds(event.value as number[])} /><label htmlFor="edit-catalog-recipe-units">Allowed recipe units</label></FloatLabel></div>
        </>}
        <div className="form-dialog__actions">
          <Button type="button" label="Archive" icon="pi pi-box" severity="danger" outlined disabled={isSaving} onClick={handleArchive} />
          <Button type="button" label="Cancel" severity="secondary" outlined disabled={isSaving} onClick={onHide} />
          <Button type="submit" label="Save changes" icon="pi pi-check" loading={isSaving} />
        </div>
      </form>
    </Dialog>
    <CreateStoreDialog visible={isCreateStoreVisible} onHide={() => setIsCreateStoreVisible(false)} onCreated={handleStoreCreated} />
    </>
  );
}
