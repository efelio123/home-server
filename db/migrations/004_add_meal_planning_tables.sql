CREATE TABLE recipes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT recipes_name_not_blank
        CHECK (char_length(btrim(name)) > 0)
);

CREATE TABLE recipe_ingredients (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
    ingredient_name VARCHAR(160) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(30),

    CONSTRAINT recipe_ingredients_name_not_blank
        CHECK (char_length(btrim(ingredient_name)) > 0),

    CONSTRAINT recipe_ingredients_quantity_is_positive
        CHECK (quantity > 0)
);

CREATE INDEX recipe_ingredients_recip_id_index
    ON recipe_ingredients (recipe_id);

CREATE TABLE meal_plan_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES recipes (id),
    planned_for DATE NOT NULL,
    meal_slot VARCHAR(20) NOT NULL DEFAULT 'dinner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT meal_plan_entries_slot_is_valid
        CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner')),

    CONSTRAINT meal_plan_entries_one_meal_per_slot
        UNIQUE (planned_for, meal_slot)
);

CREATE INDEX meal_plan_entries_planned_for_index
    ON meal_plan_entries (planned_for);

CREATE TABLE  meal_plan_entry_ingredients (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    meal_plan_entry_id BIGINT NOT NULL
        REFERENCES meal_plan_entries (id) ON DELETE CASCADE,
    ingredient_name VARCHAR(160) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(30),
    quantity_on_hand NUMERIC(10, 2) NOT NULL DEFAULT 0

    CONSTRAINT meal_plan_entry_ingredients_name_not_blank
        CHECK (char_length(btrim(ingredient_name)) > 0),

    CONSTRAINT meal_plan_entry_ingridients_quantity_is_positive
        CHECK (quantity > 0),

    CONSTRAINT meal_plan_entry_ingredients_quantity_on_hand_is_valid
        CHECK (
            quantity_on_hand >= 0
            AND quantity_on_hand <= quantity
        )
);

CREATE INDEX meal_plan_entry_ingridients_entry_id_index
    ON meal_plan_entry_ingredients (meal_plan_entry_id);