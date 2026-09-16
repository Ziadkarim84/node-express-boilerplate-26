import { Decimal } from 'decimal.js';
import { z } from 'zod';

/**
 * Money and rate arithmetic.
 *
 * MySQL DECIMAL columns are read back as strings (see db/index.ts —
 * `decimalNumbers` is deliberately off) and written as strings, so no value
 * ever passes through a JS float. Do all arithmetic here with Decimal and
 * only convert to a plain number for display.
 */
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput = Decimal.Value; // string | number | Decimal

export const SCALE = {
  amount: 2, // decimal(14,2) — amounts, prices on invoices
  unitPrice: 4, // decimal(14,4) — buying / selling price per unit
  pct: 3, // decimal(6,3) — monthly charge, advance %, close %
  quantity: 3, // decimal(14,3)
  fxRate: 6, // decimal(14,6)
} as const;

export function dec(value: DecimalInput): Decimal {
  return new Decimal(value);
}

/** Fixed-scale string for a DECIMAL column, e.g. toDb('12.5', 2) → "12.50". */
export function toDb(value: DecimalInput, scale: number): string {
  return dec(value).toFixed(scale);
}

export const toAmount = (v: DecimalInput): string => toDb(v, SCALE.amount);
export const toUnitPrice = (v: DecimalInput): string =>
  toDb(v, SCALE.unitPrice);
export const toPct = (v: DecimalInput): string => toDb(v, SCALE.pct);

export function sum(values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0));
}

/** quantity × unit price, rounded to an amount. */
export function lineAmount(
  quantity: DecimalInput,
  unitPrice: DecimalInput,
): string {
  return toAmount(dec(quantity).mul(unitPrice));
}

/** amount × pct / 100, rounded to an amount. */
export function pctOf(amount: DecimalInput, pct: DecimalInput): string {
  return toAmount(dec(amount).mul(pct).div(100));
}

/** selling = buying × (1 + monthly_charge_pct/100 × tenure_months) */
export function sellingPrice(
  buyingPrice: DecimalInput,
  monthlyChargePct: DecimalInput,
  tenureMonths: number,
): string {
  const factor = dec(monthlyChargePct).div(100).mul(tenureMonths).plus(1);
  return toUnitPrice(dec(buyingPrice).mul(factor));
}

/** principal × rate/100 × months (financing charge, SILQ profit). */
export function simpleInterest(
  principal: DecimalInput,
  monthlyRatePct: DecimalInput,
  months: number,
): string {
  return toAmount(dec(principal).mul(monthlyRatePct).div(100).mul(months));
}

export function isZero(value: DecimalInput): boolean {
  return dec(value).isZero();
}

export function gte(a: DecimalInput, b: DecimalInput): boolean {
  return dec(a).gte(b);
}

/* --------------------------- Zod request schemas --------------------------- */

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/**
 * Accepts "12.50" or 12.5 from a request body and normalises to a fixed-scale
 * string. Numbers are accepted for convenience but converted immediately, so
 * float noise never reaches the service layer.
 */
export function decimalString(
  scale: number,
  options: { min?: DecimalInput; max?: DecimalInput } = {},
) {
  return z
    .union([z.string().regex(DECIMAL_RE, 'Not a decimal'), z.number().finite()])
    .transform((v) => dec(v))
    .refine((d) => options.min === undefined || d.gte(options.min), {
      message: `Must be ≥ ${String(options.min)}`,
    })
    .refine((d) => options.max === undefined || d.lte(options.max), {
      message: `Must be ≤ ${String(options.max)}`,
    })
    .transform((d) => d.toFixed(scale));
}

export const amountSchema = decimalString(SCALE.amount, { min: 0 });
export const unitPriceSchema = decimalString(SCALE.unitPrice, { min: 0 });
export const pctSchema = decimalString(SCALE.pct, { min: 0, max: 100 });
export const quantitySchema = decimalString(SCALE.quantity, { min: 0 });
