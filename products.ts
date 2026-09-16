/**
 * Pass product definitions for BVC online pass purchases via Square.
 * Prices are in AUD cents.
 */

export const PASS_PRODUCTS = {
  "single": {
    name: "Single Session Pass",
    sessionCount: 1,
    amountCents: 1500,   // $15.00 AUD
    currency: "aud",
    active: true,
  },
  "5-pass": {
    name: "5-Session Pass",
    sessionCount: 5,
    amountCents: 6500,   // $65.00 AUD
    currency: "aud",
    active: true,
  },
  "10-pass": {
    name: "10-Session Pass",
    sessionCount: 10,
    amountCents: 12000,  // $120.00 AUD
    currency: "aud",
    active: true,
  },
  "test": {
    name: "Test Pass (1 cent)",
    sessionCount: 1,
    amountCents: 1,
    currency: "aud",
    active: false,
  },
} as const;

export type PassProductKey = keyof typeof PASS_PRODUCTS;
