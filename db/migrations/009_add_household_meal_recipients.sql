ALTER TABLE household_members
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE meal_plan_entries
ADD COLUMN household_member_id BIGINT
    REFERENCES household_members (id) ON DELETE RESTRICT;

ALTER TABLE meal_plan_entries
DROP CONSTRAINT meal_plan_entries_one_meal_per_slot;

ALTER TABLE meal_plan_entries
ADD CONSTRAINT meal_plan_entries_one_meal_per_recipient_slot
UNIQUE NULLS NOT DISTINCT (planned_for, meal_slot, household_member_id);

CREATE INDEX meal_plan_entries_household_member_id_index
    ON meal_plan_entries (household_member_id);
