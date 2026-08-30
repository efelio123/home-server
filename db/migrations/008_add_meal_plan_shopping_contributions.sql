CREATE TABLE meal_plan_shopping_list_contributions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    meal_plan_entry_id BIGINT NOT NULL
        REFERENCES meal_plan_entries (id) ON DELETE CASCADE,
    shopping_list_item_id BIGINT NOT NULL
        REFERENCES shopping_list_items (id) ON DELETE RESTRICT,
    quantity NUMERIC(10, 2) NOT NULL,

    CONSTRAINT meal_plan_shopping_list_contributions_quantity_is_positive
        CHECK (quantity > 0)
);

CREATE INDEX meal_plan_shopping_list_contributions_entry_id_index
    ON meal_plan_shopping_list_contributions (meal_plan_entry_id);
