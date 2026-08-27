import { useEffect, useState, type FormEvent } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { MultiSelect } from "primereact/multiselect";

import { createCatalogItem, getStores, getUnits } from "../api/client";
import type { CatalogItem, CatalogItemType, Store, Unit, UnitDimension } from "../api/types";
import "../styles/forms.css";
import { CreateStoreDialog } from "./CreateStoreDialog";

interface Props {
  fixedItemType?: CatalogItemType;
  initialName?: string;
  visible: boolean;
  onHide: () => void;
  onCreated: (item: CatalogItem) => void;
}

const itemTypeOptions = [
  { label: "Food", value: "food" },
  { label: "Household item", value: "household" },
];
const dimensionOptions = [
  { label: "Volume", value: "volume" },
  { label: "Mass", value: "mass" },
  { label: "Count", value: "count" },
];

export function CreateCatalogItemDialog({ fixedItemType, initialName, visible, onHide, onCreated }: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [itemType, setItemType] = useState<CatalogItemType>(fixedItemType ?? "food");
  const [category, setCategory] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [dimension, setDimension] = useState<UnitDimension | null>(null);
  const [baseUnitId, setBaseUnitId] = useState<number | null>(null);
  const [purchaseUnitId, setPurchaseUnitId] = useState<number | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState<number | null>(1);
  const [recipeUnitIds, setRecipeUnitIds] = useState<number[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [isCreateStoreVisible, setIsCreateStoreVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  function resetForm() {
    setName("");
    setItemType(fixedItemType ?? "food");
    setCategory("");
    setDimension(null);
    setBaseUnitId(null);
    setPurchaseUnitId(null);
    setPurchaseQuantity(1);
    setRecipeUnitIds([]);
    setStoreId(null);
    setErrorMessage(null);
  }

  function handleHide() {
    resetForm();
    onHide();
  }

  function handleDimensionChange(nextDimension: UnitDimension) {
    setDimension(nextDimension);
    setBaseUnitId(null);
    setPurchaseUnitId(null);
    setRecipeUnitIds([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedType = fixedItemType ?? itemType;
    const hasInvalidFoodMeasurements = selectedType === "food" && (
      !dimension ||
      baseUnitId === null ||
      purchaseUnitId === null ||
      purchaseQuantity === null ||
      purchaseQuantity <= 0 ||
      recipeUnitIds.length === 0
    );
    if (!name.trim() || hasInvalidFoodMeasurements) {
      setErrorMessage("Complete all required measurement fields.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const createdItem = await createCatalogItem({
        name: name.trim(),
        item_type: selectedType,
        category: category.trim() || null,
        measurement_dimension: selectedType === "food" ? dimension : null,
        base_unit_id: selectedType === "food" ? baseUnitId : null,
        purchase_unit_id: selectedType === "food" ? purchaseUnitId : null,
        purchase_quantity: selectedType === "food" ? purchaseQuantity : null,
        store_id: storeId,
        recipe_unit_ids: selectedType === "food" ? recipeUnitIds : [],
      });
      onCreated(createdItem);
      handleHide();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create the Pantry item.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedType = fixedItemType ?? itemType;
  const compatibleUnits = units.filter((unit) => unit.dimension === dimension);

  function handleStoreCreated(store: Store) {
    setStores((current) => [...current, store].sort((first, second) => first.name.localeCompare(second.name)));
    setStoreId(store.id);
    setIsCreateStoreVisible(false);
  }

  return (
    <>
    <Dialog header={fixedItemType === "food" ? "Create food item" : "Create Pantry item"} modal style={{ width: "min(36rem, 95vw)" }} visible={visible} onHide={handleHide}>
      <form className="form-dialog" onSubmit={handleSubmit}>
        {errorMessage && <Message severity="error" text={errorMessage} />}

        <div className="form-dialog__field"><FloatLabel><InputText id="catalog-item-name" value={name} onChange={(event) => setName(event.target.value)} /><label htmlFor="catalog-item-name">Name</label></FloatLabel></div>

        {!fixedItemType && (
          <div className="form-dialog__field"><FloatLabel><Dropdown inputId="catalog-item-type" optionLabel="label" optionValue="value" options={itemTypeOptions} value={itemType} onChange={(event) => { const nextType = event.value as CatalogItemType; setItemType(nextType); if (nextType === "household") setRecipeUnitIds([]); }} /><label htmlFor="catalog-item-type">Type</label></FloatLabel></div>
        )}

        <div className="form-dialog__field"><FloatLabel><InputText id="catalog-item-category" value={category} onChange={(event) => setCategory(event.target.value)} /><label htmlFor="catalog-item-category">Category (optional)</label></FloatLabel></div>

        <div className="form-dialog__field"><FloatLabel><Dropdown inputId="catalog-item-store" showClear optionLabel="name" optionValue="id" options={stores} value={storeId} placeholder="Any store" panelFooterTemplate={(_props, hide) => <div className="form-dialog__dropdown-footer"><Button label="Add a new store" icon="pi pi-plus" outlined size="small" type="button" onClick={() => { hide(); setIsCreateStoreVisible(true); }} /></div>} onChange={(event) => setStoreId((event.value as number) ?? null)} /><label htmlFor="catalog-item-store">Store (optional)</label></FloatLabel></div>

        {selectedType === "food" && (
          <>
          <div className="form-dialog__field"><FloatLabel><Dropdown inputId="catalog-dimension" optionLabel="label" optionValue="value" options={dimensionOptions} value={dimension} onChange={(event) => handleDimensionChange(event.value as UnitDimension)} /><label htmlFor="catalog-dimension">Measurement type</label></FloatLabel></div>
          <div className="form-dialog__field">
            <FloatLabel><Dropdown inputId="catalog-base-unit" disabled={!dimension} optionLabel="display_name" optionValue="id" options={compatibleUnits} value={baseUnitId} onChange={(event) => setBaseUnitId(event.value as number)} /><label htmlFor="catalog-base-unit">Base unit</label></FloatLabel>
            <small className="form-dialog__helper-text">Inventory math is stored in this unit.</small>
          </div>
          <div className="form-dialog__measurement-row">
            <div className="form-dialog__field"><FloatLabel><InputNumber inputId="catalog-purchase-quantity" maxFractionDigits={3} min={0.001} value={purchaseQuantity} onValueChange={(event) => setPurchaseQuantity(event.value ?? null)} /><label htmlFor="catalog-purchase-quantity">Purchase quantity</label></FloatLabel></div>
            <div className="form-dialog__field"><FloatLabel><Dropdown inputId="catalog-purchase-unit" disabled={!dimension} optionLabel="display_name" optionValue="id" options={compatibleUnits} value={purchaseUnitId} onChange={(event) => setPurchaseUnitId(event.value as number)} /><label htmlFor="catalog-purchase-unit">Purchase unit</label></FloatLabel></div>
          </div>
          <div className="form-dialog__field"><FloatLabel><MultiSelect inputId="catalog-recipe-units" disabled={!dimension} optionLabel="display_name" optionValue="id" options={compatibleUnits} value={recipeUnitIds} onChange={(event) => setRecipeUnitIds(event.value as number[])} /><label htmlFor="catalog-recipe-units">Allowed recipe units</label></FloatLabel></div>
          </>
        )}

        <div className="form-dialog__actions">
          <Button label="Cancel" severity="secondary" outlined type="button" disabled={isSubmitting} onClick={handleHide} />
          <Button label="Create item" icon="pi pi-check" loading={isSubmitting} type="submit" />
        </div>
      </form>
    </Dialog>
    <CreateStoreDialog visible={isCreateStoreVisible} onHide={() => setIsCreateStoreVisible(false)} onCreated={handleStoreCreated} />
    </>
  );
}
