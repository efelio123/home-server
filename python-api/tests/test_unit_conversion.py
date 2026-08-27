from decimal import Decimal

from unit_conversion import purchase_packages_needed, to_base_quantity


def test_converts_recipe_units_to_catalog_base_unit():
    cups = Decimal("2")
    milliliters_per_cup = Decimal("236.588236")
    milliliters_per_fluid_ounce = Decimal("29.573529")

    result = to_base_quantity(
        cups,
        milliliters_per_cup,
        milliliters_per_fluid_ounce,
    )

    assert result.quantize(Decimal("0.000001")) == Decimal("16.000000")


def test_rounds_shortage_up_to_a_whole_purchase_package():
    result = purchase_packages_needed(
        required_base_quantity=Decimal("3"),
        purchase_quantity=Decimal("12"),
        purchase_unit_base_quantity=Decimal("1"),
    )

    assert result == 1


def test_requires_two_packages_when_shortage_exceeds_one_package():
    result = purchase_packages_needed(
        required_base_quantity=Decimal("13"),
        purchase_quantity=Decimal("12"),
        purchase_unit_base_quantity=Decimal("1"),
    )

    assert result == 2
