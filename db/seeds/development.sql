INSERT INTO household_members (display_name)
SELECT seed.display_name
FROM (
    VALUES
        ('Alex'),
        ('Sam')
) AS seed(display_name)
WHERE NOT EXISTS (
    SELECT 1
    FROM household_members
    WHERE display_name = seed.display_name
);

INSERT INTO chores (
    title,
    details,
    assignee_id,
    due_date,
    status
)
SELECT
    'Take out recycling',
    'Place the bins by the curb.',
    member.id,
    CURRENT_DATE,
    'open'
FROM household_members AS member
WHERE member.display_name = 'Alex'
  AND NOT EXISTS (
    SELECT 1
    FROM chores
    WHERE title = 'Take out recycling'
  );

INSERT INTO chores (
    title,
    assignee_id,
    status,
    completed_at
)
SELECT
    'Feed the dog',
    member.id,
    'completed',
    CURRENT_TIMESTAMP
FROM household_members AS member
WHERE member.display_name = 'Sam'
  AND NOT EXISTS (
      SELECT 1
      FROM chores
      WHERE title = 'Feed the dog'
  );

INSERT INTO shopping_list_items (
    item_name,
    quantity,
    unit,
    category
)
SELECT
    seed.item_name,
    seed.quantity,
    seed.unit,
    seed.category
FROM (
    VALUES
        ('Milk', 1.00, 'gallon', 'Dairy'),
        ('Bananas', 6.00, 'each', 'Produce'),
        ('Dish Soap', 1.00, 'bottle', 'Household')
) AS seed(item_name, quantity, unit, category)
WHERE NOT EXISTS (
    SELECT 1
    FROM shopping_list_items
    WHERE shopping_list_items.item_name = seed.item_name
);

INSERT INTO recipes (name, instructions)
SELECT
    seed.name,
    seed.instructions
FROM (
    VALUES
        (
            'Chicken tacos',
            'Cook the chicken, warm the tortillas, and assemble.'
        ),
        (
            'Spaghetti with meat sauce',
            'Cook pasta, prepare the sauce, and combine.'
        )
) AS seed(name, instructions)
WHERE NOT EXISTS (
    SELECT 1
    FROM recipes
    WHERE recipes.name = seed.name
);

INSERT INTO recipe_ingredients (
    recipe_id,
    ingredient_name,
    quantity,
    unit
)
SELECT
    recipes.id,
    seed.ingredient_name,
    seed.quantity,
    seed.unit
FROM recipes
JOIN (
    VALUES
        ('Chicken tacos', 'Tortillas', 8.00, 'each'),
        ('Chicken tacos', 'Chicken breast', 1.50, 'pounds'),
        ('Chicken tacos', 'Salsa', 1.00, 'jar'),
        ('Chicken tacos', 'Shredded cheese', 1.00, 'bag'),
        ('Spaghetti with meat sauce', 'Spaghetti', 1.00, 'box'),
        ('Spaghetti with meat sauce', 'Ground beef', 1.00, 'pound'),
        ('Spaghetti with meat sauce', 'Pasta sauce', 1.00, 'jar')
) AS seed(recipe_name, ingredient_name, quantity, unit)
    ON recipes.name = seed.recipe_name
WHERE NOT EXISTS (
    SELECT 1
    FROM recipe_ingredients
    WHERE recipe_ingredients.recipe_id = recipes.id
      AND recipe_ingredients.ingredient_name = seed.ingredient_name
);