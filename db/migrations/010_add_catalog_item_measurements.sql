CREATE TABLE units (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    display_name VARCHAR(60) NOT NULL,
    dimension VARCHAR(20) NOT NULL,
    base_quantity NUMERIC(16, 6) NOT NULL,

    CONSTRAINT units_code_is_unique UNIQUE (code),
    CONSTRAINT units_dimension_is_valid
        CHECK (dimension IN ('volume', 'mass', 'count')),
    CONSTRAINT units_base_quantity_is_positive
        CHECK (base_quantity > 0)
);

CREATE TABLE stores (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT stores_name_not_blank
        CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX stores_name_normalized_unique
ON stores (lower(btrim(name)));

INSERT INTO units (code, display_name, dimension, base_quantity)
VALUES
    ('milliliter', 'Milliliter', 'volume', 1),
    ('liter', 'Liter', 'volume', 1000),
    ('teaspoon', 'Teaspoon', 'volume', 4.928922),
    ('tablespoon', 'Tablespoon', 'volume', 14.786765),
    ('fluid_ounce', 'Fluid ounce', 'volume', 29.573529),
    ('cup', 'Cup', 'volume', 236.588236),
    ('pint', 'Pint', 'volume', 473.176473),
    ('quart', 'Quart', 'volume', 946.352946),
    ('gallon', 'Gallon', 'volume', 3785.411784),
    ('gram', 'Gram', 'mass', 1),
    ('kilogram', 'Kilogram', 'mass', 1000),
    ('ounce', 'Ounce', 'mass', 28.349523),
    ('pound', 'Pound', 'mass', 453.592370),
    ('each', 'Each', 'count', 1),
    ('dozen', 'Dozen', 'count', 12);

ALTER TABLE catalog_items
ADD COLUMN measurement_dimension VARCHAR(20),
ADD COLUMN base_unit_id BIGINT REFERENCES units (id),
ADD COLUMN purchase_unit_id BIGINT REFERENCES units (id),
ADD COLUMN purchase_quantity NUMERIC(16, 6),
ADD COLUMN store_id BIGINT REFERENCES stores (id);

ALTER TABLE catalog_items
ADD CONSTRAINT catalog_items_measurement_dimension_is_valid
CHECK (
    measurement_dimension IS NULL
    OR measurement_dimension IN ('volume', 'mass', 'count')
);

ALTER TABLE catalog_items
ADD CONSTRAINT catalog_items_purchase_quantity_is_positive
CHECK (purchase_quantity IS NULL OR purchase_quantity > 0);

CREATE TABLE catalog_item_recipe_units (
    catalog_item_id BIGINT NOT NULL
        REFERENCES catalog_items (id) ON DELETE CASCADE,
    unit_id BIGINT NOT NULL REFERENCES units (id),
    PRIMARY KEY (catalog_item_id, unit_id)
);

ALTER TABLE recipe_ingredients
ADD COLUMN unit_id BIGINT REFERENCES units (id),
ADD COLUMN quantity_in_base_units NUMERIC(16, 6);

ALTER TABLE recipe_ingredients
ADD CONSTRAINT recipe_ingredients_base_quantity_is_positive
CHECK (quantity_in_base_units IS NULL OR quantity_in_base_units > 0);

ALTER TABLE meal_plan_entry_ingredients
ADD COLUMN unit_id BIGINT REFERENCES units (id),
ADD COLUMN quantity_in_base_units NUMERIC(16, 6),
ADD COLUMN quantity_on_hand_in_base_units NUMERIC(16, 6);

ALTER TABLE meal_plan_entry_ingredients
ADD CONSTRAINT meal_plan_entry_ingredients_base_quantity_is_positive
CHECK (quantity_in_base_units IS NULL OR quantity_in_base_units > 0),
ADD CONSTRAINT meal_plan_entry_ingredients_on_hand_base_quantity_is_valid
CHECK (
    quantity_on_hand_in_base_units IS NULL
    OR quantity_on_hand_in_base_units >= 0
);
