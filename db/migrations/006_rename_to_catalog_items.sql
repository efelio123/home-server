-- Rename the shared entity from “ingredients” to the broader catalog concept.
ALTER TABLE ingredients
RENAME TO catalog_items;

ALTER TABLE catalog_items
RENAME CONSTRAINT ingredients_pkey TO catalog_items_pkey;

ALTER TABLE catalog_items
RENAME CONSTRAINT ingredients_name_not_blank
TO catalog_items_name_not_blank;

ALTER INDEX ingredients_name_normalized_unique
RENAME TO catalog_items_name_normalized_unique;


-- Current records are cooking ingredients; future records may be household items.
ALTER TABLE catalog_items
ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT 'food';

ALTER TABLE catalog_items
ADD CONSTRAINT catalog_items_type_is_valid
CHECK (item_type IN ('food', 'household'));


-- Rename the transitional foreign keys to match the new domain name.
ALTER TABLE recipe_ingredients
RENAME COLUMN ingredient_id TO catalog_item_id;

ALTER TABLE shopping_list_items
RENAME COLUMN ingredient_id TO catalog_item_id;

ALTER TABLE meal_plan_entry_ingredients
RENAME COLUMN ingredient_id TO catalog_item_id;


-- Rename the indexes and foreign-key constraints created in migration 005.
ALTER INDEX recipe_ingredients_ingredient_id_index
RENAME TO recipe_ingredients_catalog_item_id_index;

ALTER INDEX shopping_list_items_ingredient_id_index
RENAME TO shopping_list_items_catalog_item_id_index;

ALTER INDEX meal_plan_entry_ingredients_ingredient_id_index
RENAME TO meal_plan_entry_ingredients_catalog_item_id_index;

ALTER TABLE recipe_ingredients
RENAME CONSTRAINT recipe_ingredients_ingredient_id_fkey
TO recipe_ingredients_catalog_item_id_fkey;

ALTER TABLE shopping_list_items
RENAME CONSTRAINT shopping_list_items_ingredient_id_fkey
TO shopping_list_items_catalog_item_id_fkey;

ALTER TABLE meal_plan_entry_ingredients
RENAME CONSTRAINT meal_plan_entry_ingredients_ingredient_id_fkey
TO meal_plan_entry_ingredients_catalog_item_id_fkey;
