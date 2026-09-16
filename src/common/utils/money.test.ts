import { describe, expect, it } from 'vitest';
import {
  amountSchema,
  lineAmount,
  pctOf,
  sellingPrice,
  simpleInterest,
  sum,
  toAmount,
} from './money.js';

describe('money', () => {
  it('never leaks float noise', () => {
    expect(toAmount(sum(['0.1', '0.2']))).toBe('0.30');
    expect(lineAmount('1000', '8.5')).toBe('8500.00');
  });

  it('reproduces the trade SQ-9200018 figures', () => {
    // supplier invoice 12,100; 3% × 2 months
    expect(sellingPrice('8.5', '3', 2)).toBe('9.0100');
    expect(sellingPrice('7.2', '3', 2)).toBe('7.6320');
    expect(pctOf('12100', '20')).toBe('2420.00'); // advance
    expect(simpleInterest('9680', '3', 2)).toBe('580.80'); // SILQ profit
    expect(simpleInterest('3000.80', '2', 2)).toBe('120.03'); // financing
  });

  it('validates and normalises request decimals', () => {
    expect(amountSchema.parse('12.5')).toBe('12.50');
    expect(amountSchema.parse(12.5)).toBe('12.50');
    expect(() => amountSchema.parse('-1')).toThrow();
    expect(() => amountSchema.parse('abc')).toThrow();
  });
});
