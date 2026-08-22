CREATE TABLE household_members (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    display_name VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT household_members_display_name_not_blank
        CHECK (char_length(btrim(display_name)) > 0)
);

CREATE TABLE chores (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    details TEXT,
    asignee_id BIGINT REFERENCES household_members (id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chores_title_not_blank
        CHECK (char_length(btrim(title)) > 0),

    CONSTRAINT chores_status_is_valid
        CHECK (status IN ('open', 'completed')),

    CONSTRAINT chores_compleetion_is_consistent
        CHECK (
            (status = 'open' AND completed_at IS NULL)
            OR
            (status = 'completed' AND completed_at IS NOT NULL)
        )
);

CREATE INDEX chores_open_due_date_index
    ON chores (due_date)
    WHERE status = 'open';

CREATE TABLE shopping_list_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_name VARCHAR(160) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit VARCHAR(30),
    category VARCHAR(60),
    is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
    purchased_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT shopping_list_items_name_not_blank
        CHECK (char_length(btrim(item_name)) > 0),

    CONSTRAINT shopping_list_items_quantity_is_positive
        CHECK (quantity > 0),

    CONSTRAINT shopping_list_items_purchase_is_consistent
        CHECK (
            (is_purchased = FALSE AND purchased_at IS NULL)
            OR
            (is_purchased = TRUE AND purchased_at IS NOT NULL)
        )
);

CREATE INDEX shopping_list_items_unpurchased_index
    ON shopping_list_items (created_at DESC)
    WHERE is_purchased = FALSE;