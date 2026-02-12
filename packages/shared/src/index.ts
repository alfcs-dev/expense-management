export const CURRENCY = ["MXN", "USD"] as const;
export type Currency = (typeof CURRENCY)[number];
