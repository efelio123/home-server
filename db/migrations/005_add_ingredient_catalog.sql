-- Correct earlier spelling mistakes in database-object names.
ALTER INDEX meal_plan_entry_ingridients_entry_id_index
RENAME TO meal_plan_entry_ingredients_entry_id_index;

ALTER TABLE meal_plan_entry_ingredients
RENAME CONSTRAINT meal_plan_entry_ingridients_quantity_is_positive
TO meal_plan_entry_ingredients_quantity_is_positive;

-- Canonical ingredient catalog.
CREATE TABLE ingredients (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(80),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ingredients_name_not_blank
        CHECK (char_length(btrim(name)) > 0)
);

-- Prevents separate “Milk” and “milk” records.
CREATE UNIQUE INDEX ingredients_name_normalized_unique
ON ingredients (lower(btrim(name)));

-- Transitional links. They stay nullable for now so existing API writes
-- continue working until we update those APIs in the next step.
ALTER TABLE recipe_ingredients
ADD COLUMN ingredient_id BIGINT REFERENCES ingredients(id);

ALTER TABLE shopping_list_items
ADD COLUMN ingredient_id BIGINT REFERENCES ingredients(id);

ALTER TABLE meal_plan_entry_ingredients
ADD COLUMN ingredient_id BIGINT REFERENCES ingredients(id);

-- Create one canonical record for every existing ingredient-like name.
WITH source_names AS (
    SELECT ingredient_name AS name
    FROM recipe_ingredients

    UNION ALL

    SELECT item_name AS name
    FROM shopping_list_items

    UNION ALL

    SELECT ingredient_name AS name
    FROM meal_plan_entry_ingredients
),
canonical_names AS (
    SELECT DISTINCT ON (lower(btrim(name)))
        btrim(name) AS name
    FROM source_names
    WHERE name IS NOT NULL
      AND char_length(btrim(name)) > 0
    ORDER BY lower(btrim(name)), btrim(name)
)
INSERT INTO ingredients (name)
SELECT name
FROM canonical_names
ON CONFLICT DO NOTHING;

-- Link existing records to their canonical ingredient.
UPDATE recipe_ingredients
SET ingredient_id = ingredients.id
FROM ingredients
WHERE lower(btrim(recipe_ingredients.ingredient_name))
    = lower(btrim(ingredients.name));

UPDATE shopping_list_items
SET ingredient_id = ingredients.id
FROM ingredients
WHERE lower(btrim(shopping_list_items.item_name))
    = lower(btrim(ingredients.name));

UPDATE meal_plan_entry_ingredients
SET ingredient_id = ingredients.id
FROM ingredients
WHERE lower(btrim(meal_plan_entry_ingredients.ingredient_name))
    = lower(btrim(ingredients.name));

-- Foreign keys do not automatically get indexes.
CREATE INDEX recipe_ingredients_ingredient_id_index
ON recipe_ingredients (ingredient_id);

CREATE INDEX shopping_list_items_ingredient_id_index
ON shopping_list_items (ingredient_id);

CREATE INDEX meal_plan_entry_ingredients_ingredient_id_index
ON meal_plan_entry_ingredients (ingredient_id);
