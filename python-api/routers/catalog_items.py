from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from auth import require_login
from database import get_db_connection

router = APIRouter(prefix="/catalog-items", tags=["catalog items"])
Dimension = Literal["volume", "mass", "count"]
ItemType = Literal["food", "household"]
CATALOG_COLUMNS = """id, name, item_type, category, is_active, default_unit,
measurement_dimension, base_unit_id, purchase_unit_id, purchase_quantity,
store_id, (SELECT stores.name FROM stores WHERE stores.id = catalog_items.store_id)
AS store_name, created_at"""


class CatalogItemResponse(BaseModel):
    id: int
    name: str
    item_type: ItemType
    category: str | None
    is_active: bool
    created_at: datetime
    default_unit: str | None
    measurement_dimension: Dimension | None
    base_unit_id: int | None
    purchase_unit_id: int | None
    purchase_quantity: float | None
    store_id: int | None
    store_name: str | None
    recipe_unit_ids: list[int] = Field(default_factory=list)


class CatalogItemCreate(BaseModel):
    name: str
    item_type: ItemType = "food"
    category: str | None = None
    measurement_dimension: Dimension | None = None
    base_unit_id: int | None = None
    purchase_unit_id: int | None = None
    purchase_quantity: float | None = Field(default=None, gt=0)
    store_id: int | None = None
    recipe_unit_ids: list[int] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank.")
        return value

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class CatalogItemUpdate(BaseModel):
    name: str | None = None
    item_type: ItemType | None = None
    category: str | None = None
    is_active: bool | None = None
    measurement_dimension: Dimension | None = None
    base_unit_id: int | None = None
    purchase_unit_id: int | None = None
    purchase_quantity: float | None = Field(default=None, gt=0)
    store_id: int | None = None
    recipe_unit_ids: list[int] | None = None


def add_recipe_units(connection, item: dict) -> dict:
    item["recipe_unit_ids"] = [row["unit_id"] for row in connection.execute(
        "SELECT unit_id FROM catalog_item_recipe_units WHERE catalog_item_id = %s ORDER BY unit_id",
        (item["id"],),
    ).fetchall()]
    return item


def validate_measurements(connection, dimension, base_unit_id, purchase_unit_id, recipe_unit_ids, item_type):
    if item_type == "food" and not recipe_unit_ids:
        raise HTTPException(status_code=422, detail="Choose at least one recipe unit.")
    unit_ids = {base_unit_id, purchase_unit_id, *recipe_unit_ids}
    units = connection.execute(
        "SELECT id, display_name, dimension FROM units WHERE id = ANY(%s)",
        (list(unit_ids),),
    ).fetchall()
    if len(units) != len(unit_ids) or any(unit["dimension"] != dimension for unit in units):
        raise HTTPException(status_code=422, detail="All selected units must match the measurement type.")
    return next(unit["display_name"] for unit in units if unit["id"] == purchase_unit_id)


def validate_store(connection, store_id: int | None):
    if store_id is None:
        return
    if connection.execute(
        "SELECT 1 FROM stores WHERE id = %s AND is_active = TRUE",
        (store_id,),
    ).fetchone() is None:
        raise HTTPException(status_code=422, detail="Choose an active store.")


@router.get("", response_model=list[CatalogItemResponse])
def list_catalog_items(include_inactive: bool = Query(False), item_type: ItemType | None = Query(None), search: str | None = Query(None), _username: str = Depends(require_login)):
    pattern = f"%{search.strip()}%" if search and search.strip() else None
    with get_db_connection() as connection:
        items = connection.execute(
            f"""SELECT {CATALOG_COLUMNS} FROM catalog_items
            WHERE (%s OR is_active = TRUE) AND (%s::text IS NULL OR item_type = %s)
              AND (%s::text IS NULL OR name ILIKE %s) ORDER BY item_type, name""",
            (include_inactive, item_type, item_type, pattern, pattern),
        ).fetchall()
        return [add_recipe_units(connection, item) for item in items]


@router.post("", response_model=CatalogItemResponse, status_code=status.HTTP_201_CREATED)
def create_catalog_item(item: CatalogItemCreate, _username: str = Depends(require_login)):
    with get_db_connection() as connection:
        validate_store(connection, item.store_id)
        if item.item_type == "food":
            if any(value is None for value in (
                item.measurement_dimension,
                item.base_unit_id,
                item.purchase_unit_id,
                item.purchase_quantity,
            )):
                raise HTTPException(
                    status_code=422,
                    detail="Food items require a complete measurement configuration.",
                )
            purchase_name = validate_measurements(
                connection,
                item.measurement_dimension,
                item.base_unit_id,
                item.purchase_unit_id,
                item.recipe_unit_ids,
                item.item_type,
            )
            dimension = item.measurement_dimension
            base_unit_id = item.base_unit_id
            purchase_unit_id = item.purchase_unit_id
            purchase_quantity = item.purchase_quantity
            recipe_unit_ids = item.recipe_unit_ids
        else:
            purchase_name = None
            dimension = None
            base_unit_id = None
            purchase_unit_id = None
            purchase_quantity = None
            recipe_unit_ids = []
        created = connection.execute(
            f"""INSERT INTO catalog_items (name, item_type, category, default_unit,
            measurement_dimension, base_unit_id, purchase_unit_id, purchase_quantity,
            store_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING RETURNING {CATALOG_COLUMNS}""",
            (item.name, item.item_type, item.category, purchase_name, dimension,
             base_unit_id, purchase_unit_id, purchase_quantity,
             item.store_id),
        ).fetchone()
        if created is None:
            raise HTTPException(status_code=409, detail="A catalog item with that name already exists.")
        for unit_id in recipe_unit_ids:
            connection.execute("INSERT INTO catalog_item_recipe_units (catalog_item_id, unit_id) VALUES (%s, %s)", (created["id"], unit_id))
        return add_recipe_units(connection, created)


@router.patch("/{item_id}", response_model=CatalogItemResponse)
def update_catalog_item(item_id: int, item: CatalogItemUpdate, _username: str = Depends(require_login)):
    fields = item.model_fields_set
    if not fields:
        raise HTTPException(status_code=422, detail="Provide at least one field to update.")
    with get_db_connection() as connection:
        current = connection.execute(f"SELECT {CATALOG_COLUMNS} FROM catalog_items WHERE id = %s", (item_id,)).fetchone()
        if current is None:
            raise HTTPException(status_code=404, detail="Catalog item not found.")
        current_units = [row["unit_id"] for row in connection.execute("SELECT unit_id FROM catalog_item_recipe_units WHERE catalog_item_id = %s", (item_id,)).fetchall()]
        merged = {
            "dimension": item.measurement_dimension if "measurement_dimension" in fields else current["measurement_dimension"],
            "base_unit_id": item.base_unit_id if "base_unit_id" in fields else current["base_unit_id"],
            "purchase_unit_id": item.purchase_unit_id if "purchase_unit_id" in fields else current["purchase_unit_id"],
            "recipe_unit_ids": item.recipe_unit_ids if "recipe_unit_ids" in fields else current_units,
            "item_type": item.item_type if "item_type" in fields else current["item_type"],
        }
        measurement_fields = {
            "measurement_dimension", "base_unit_id", "purchase_unit_id",
            "purchase_quantity", "recipe_unit_ids",
        }
        has_complete_measurements = not any(
            merged[key] is None
            for key in ("dimension", "base_unit_id", "purchase_unit_id")
        ) and (
            item.purchase_quantity
            if "purchase_quantity" in fields
            else current["purchase_quantity"]
        ) is not None
        if fields & measurement_fields and not has_complete_measurements:
            raise HTTPException(status_code=422, detail="Complete the measurement configuration.")
        purchase_name = current["default_unit"]
        if has_complete_measurements:
            purchase_name = validate_measurements(connection, **merged)
        if merged["item_type"] == "household" and current["item_type"] == "food" and connection.execute("SELECT 1 FROM recipe_ingredients WHERE catalog_item_id = %s LIMIT 1", (item_id,)).fetchone():
            raise HTTPException(status_code=409, detail="This food item is used by recipes and cannot be changed to household.")
        if "store_id" in fields:
            validate_store(connection, item.store_id)
        clauses, parameters = [], []
        if purchase_name != current["default_unit"]:
            clauses.append("default_unit = %s")
            parameters.append(purchase_name)
        for field_name in ("name", "item_type", "category", "is_active", "measurement_dimension", "base_unit_id", "purchase_unit_id", "purchase_quantity", "store_id"):
            if field_name in fields:
                value = getattr(item, field_name)
                if field_name in ("name", "item_type", "is_active", "measurement_dimension", "base_unit_id", "purchase_unit_id", "purchase_quantity") and value is None:
                    raise HTTPException(status_code=422, detail=f"{field_name} cannot be null.")
                if field_name == "name" and isinstance(value, str) and not value.strip():
                    raise HTTPException(status_code=422, detail="Name cannot be blank.")
                clauses.append(f"{field_name} = %s")
                parameters.append(value.strip() if field_name == "name" and isinstance(value, str) else value)
        if "name" in fields:
            duplicate = connection.execute(
                "SELECT 1 FROM catalog_items WHERE lower(name) = lower(%s) AND id <> %s",
                (item.name, item_id),
            ).fetchone()
            if duplicate:
                raise HTTPException(status_code=409, detail="A catalog item with that name already exists.")
        if clauses:
            parameters.append(item_id)
            updated = connection.execute(f"UPDATE catalog_items SET {', '.join(clauses)} WHERE id = %s RETURNING {CATALOG_COLUMNS}", tuple(parameters)).fetchone()
        else:
            updated = current
        if "recipe_unit_ids" in fields:
            connection.execute("DELETE FROM catalog_item_recipe_units WHERE catalog_item_id = %s", (item_id,))
            for unit_id in item.recipe_unit_ids or []:
                connection.execute("INSERT INTO catalog_item_recipe_units (catalog_item_id, unit_id) VALUES (%s, %s)", (item_id, unit_id))
        return add_recipe_units(connection, updated)
