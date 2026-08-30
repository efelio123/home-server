ALTER TABLE recipes
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX recipes_active_name_index
ON recipes (is_active, name);
