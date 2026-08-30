ALTER TABLE catalog_items
ADD COLUMN default_unit VARCHAR(30);

ALTER TABLE catalog_items
ADD CONSTRAINT catalog_items_default_unit_not_blank
CHECK (
    default_unit IS NULL
    OR char_length(btrim(default_unit)) > 0
);


-- Choose the most commonly used existing unit for each catalog item.
-- Alphabetical order provides a stable tie-breaker.
WITH unit_usage AS (
    SELECT
        catalog_item_id,
        btrim(unit) AS unit
    FROM recipe_ingredients

    UNION ALL

    SELECT
        catalog_item_id,
        btrim(unit) AS unit
    FROM shopping_list_items

    UNION ALL

    SELECT
        catalog_item_id,
        btrim(unit) AS unit
    FROM meal_plan_entry_ingredients
),
unit_counts AS (
    SELECT
        catalog_item_id,
        unit,
        count(*) AS usage_count
    FROM unit_usage
    WHERE catalog_item_id IS NOT NULL
      AND unit IS NOT NULL
      AND char_length(unit) > 0
    GROUP BY catalog_item_id, unit
),
ranked_units AS (
    SELECT
        catalog_item_id,
        unit,
        row_number() OVER (
            PARTITION BY catalog_item_id
            ORDER BY usage_count DESC, unit
        ) AS rank
    FROM unit_counts
)
UPDATE catalog_items
SET default_unit = ranked_units.unit
FROM ranked_units
WHERE catalog_items.id = ranked_units.catalog_item_id
  AND ranked_units.rank = 1;
