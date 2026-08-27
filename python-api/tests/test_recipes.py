import pytest


@pytest.mark.anyio
async def test_create_recipe_rejects_duplicate_catalog_items(
    authenticated_client,
):

    response = await authenticated_client.post(
        "/recipes",
        json={
            "name": "Duplicate ingredient recipe",
            "ingredients": [
                {"catalog_item_id": 1, "quantity": 1, "unit_id": 1},
                {"catalog_item_id": 1, "quantity": 2, "unit_id": 1},
            ],
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == (
        "Value error, Each catalog item can appear only once in a recipe."
    )
