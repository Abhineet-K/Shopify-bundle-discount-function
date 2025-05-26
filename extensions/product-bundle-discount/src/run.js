// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {{ cart: { lines: Array<{ merchandise?: { customAttributes?: Array<{ key: string, value: string }> }, quantity: number, id: string, cost: { amountPerQuantity: { amount: number } } }>, cost: { totalAmount: { currencyCode: string } } } }} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.All,
  discounts: [],
};

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const discounts = [];
  const bundleGroups = {};

  // Iterate through the cart lines
  for (const lineItem of input.cart.lines) {
    const bundleRule = lineItem.bundleRule?.value;
    const bundleGroupId = lineItem.bundleGroupId?.value;

    if (!bundleRule || !bundleGroupId) continue;

    // Extract rule like '3for999'
    const match = bundleRule.match(/^(\d+)for(\d+)$/);
    if (!match) continue;

    const requiredQty = parseInt(match[1], 10);
    const fixedTotalPrice = parseInt(match[2], 10);

    const id = bundleGroupId;
    if (!bundleGroups[id]) {
      bundleGroups[id] = {
        lineItems: [],
        rule: { requiredQty, fixedTotalPrice },
      };
    }

    bundleGroups[id].lineItems.push({
      lineId: lineItem.id,
      quantity: lineItem.quantity,
      originalPrice: lineItem.cost.amountPerQuantity.amount,
    });
  }

  // Apply discounts
  for (const [groupId, group] of Object.entries(bundleGroups)) {
    const totalQty = group.lineItems.reduce((sum, li) => sum + li.quantity, 0);
    
    if (totalQty != group.rule.requiredQty) continue;

    // Calculate per unit fixed price
    const fixedPricePerUnit = group.rule.fixedTotalPrice / group.rule.requiredQty;

    for (const lineItem of group.lineItems) {
      const { lineId, quantity, originalPrice } = lineItem;

      // Calculate discount per unit
      const discountPerUnit = originalPrice - fixedPricePerUnit;

      // Ignore if discount is negative or zero then break to reject the discount for this bundle
      if (discountPerUnit <= 0) break;

      // Apply discount for all quantities
      const totalDiscount = discountPerUnit * quantity;

      discounts.push({
        message: `Bundle offer: ₹${fixedPricePerUnit.toFixed(2)} each`,
        targets: [
          {
            cartLine: {
              id: lineId,
            },
          },
        ],
        value: {
          fixedAmount: {
            amount: totalDiscount,
          },
        },
      });
    }
  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}
