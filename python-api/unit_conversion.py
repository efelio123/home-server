from decimal import Decimal, ROUND_CEILING


def to_base_quantity(
    quantity: Decimal,
    unit_base_quantity: Decimal,
    catalog_base_unit_quantity: Decimal = Decimal("1"),
) -> Decimal:
    """Converts a user-entered amount into its dimension's base quantity."""
    return quantity * unit_base_quantity / catalog_base_unit_quantity


def purchase_packages_needed(
    required_base_quantity: Decimal,
    purchase_quantity: Decimal,
    purchase_unit_base_quantity: Decimal,
) -> int:
    """Rounds a base-quantity shortage up to whole purchase packages."""
    package_base_quantity = purchase_quantity * purchase_unit_base_quantity
    return int(
        (required_base_quantity / package_base_quantity).to_integral_value(
            rounding=ROUND_CEILING,
        )
    )
