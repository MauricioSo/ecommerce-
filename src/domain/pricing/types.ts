export const DiscountType = {
  PERCENTAGE: "percentage",
  FIXED_AMOUNT: "fixed_amount",
  FIXED_PRICE: "fixed_price",
} as const;

export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

export const PromotionType = {
  CART_PERCENTAGE: "cart_percentage",
  CART_FIXED: "cart_fixed",
  SKU_PERCENTAGE: "sku_percentage",
  SKU_FIXED: "sku_fixed",
  BUY_X_GET_Y: "buy_x_get_y",
  FREE_SHIPPING: "free_shipping",
} as const;

export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType];
