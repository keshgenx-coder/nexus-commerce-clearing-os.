import { describe, it, expect } from 'vitest';
import {
  calculateItemTotal,
  calculateCartSubtotal,
  calculateShipping,
  calculateTax,
  calculateCartSummary,
  roundCurrency,
  STANDARD_FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_RATE,
  CartItemInput
} from '../src/utils/commerceLogic';

describe('Commerce Suite: Cart & Price Calculations', () => {
  describe('roundCurrency', () => {
    it('accurately rounds floating point values to 2 decimal places', () => {
      expect(roundCurrency(19.994)).toBe(19.99);
      expect(roundCurrency(19.996)).toBe(20.00);
      expect(roundCurrency(0.1 + 0.2)).toBe(0.30);
    });
  });

  describe('calculateItemTotal', () => {
    it('multiplies price and quantity with proper rounding', () => {
      expect(calculateItemTotal(299.99, 2)).toBe(599.98);
      expect(calculateItemTotal(15.50, 3)).toBe(46.50);
    });

    it('returns 0 for negative prices or quantities', () => {
      expect(calculateItemTotal(-10, 5)).toBe(0);
      expect(calculateItemTotal(10, -2)).toBe(0);
    });

    it('returns 0 for zero quantity', () => {
      expect(calculateItemTotal(100, 0)).toBe(0);
    });
  });

  describe('calculateCartSubtotal', () => {
    it('returns 0 for an empty cart', () => {
      expect(calculateCartSubtotal([])).toBe(0);
    });

    it('sums multiple cart items accurately', () => {
      const items: CartItemInput[] = [
        { productId: 'p1', name: 'Premium Audio SKU', price: 299.00, quantity: 1 },
        { productId: 'p2', name: 'Protective Case', price: 39.50, quantity: 2 },
        { productId: 'p3', name: 'Braided Cable', price: 19.99, quantity: 3 }
      ];
      // 299.00 + (39.50 * 2 = 79.00) + (19.99 * 3 = 59.97) = 437.97
      expect(calculateCartSubtotal(items)).toBe(437.97);
    });

    it('handles decimal prices and fractional quantities safely', () => {
      const items: CartItemInput[] = [
        { productId: 'p1', name: 'Item A', price: 0.99, quantity: 10 },
        { productId: 'p2', name: 'Item B', price: 1.49, quantity: 5 }
      ];
      // 9.90 + 7.45 = 17.35
      expect(calculateCartSubtotal(items)).toBe(17.35);
    });
  });

  describe('calculateShipping', () => {
    it('returns $0 for an empty cart ($0 subtotal)', () => {
      expect(calculateShipping(0)).toBe(0);
    });

    it('applies standard shipping fee ($15) when below $150 threshold', () => {
      expect(calculateShipping(50)).toBe(STANDARD_SHIPPING_RATE);
      expect(calculateShipping(149.99)).toBe(STANDARD_SHIPPING_RATE);
    });

    it('grants free shipping ($0) when subtotal meets or exceeds $150 threshold', () => {
      expect(calculateShipping(STANDARD_FREE_SHIPPING_THRESHOLD)).toBe(0);
      expect(calculateShipping(250.00)).toBe(0);
      expect(calculateShipping(1500.00)).toBe(0);
    });

    it('supports custom shipping rates and thresholds', () => {
      expect(calculateShipping(80, 100, 25)).toBe(25);
      expect(calculateShipping(120, 100, 25)).toBe(0);
    });
  });

  describe('calculateTax', () => {
    it('returns 0 for negative or zero taxable amounts', () => {
      expect(calculateTax(0)).toBe(0);
      expect(calculateTax(-50)).toBe(0);
    });

    it('calculates standard 8.25% sales tax correctly', () => {
      // 100 * 0.0825 = 8.25
      expect(calculateTax(100.00)).toBe(8.25);
      // 250 * 0.0825 = 20.625 -> rounds to 20.63
      expect(calculateTax(250.00)).toBe(20.63);
    });

    it('supports custom enterprise VAT and regional tax rates', () => {
      // 20% UK / EU VAT
      expect(calculateTax(200.00, 0.20)).toBe(40.00);
      // 0% Tax exempt
      expect(calculateTax(200.00, 0.00)).toBe(0);
    });
  });

  describe('calculateCartSummary (Full Integration)', () => {
    it('computes complete end-to-end cart breakdown with free shipping and tax', () => {
      const items: CartItemInput[] = [
        { productId: 'sku-1', name: 'Flagship ANC Headphones', price: 299.00, quantity: 1 }
      ];

      // Subtotal = 299.00 (>150 -> shipping = 0)
      // Tax = 299 * 0.0825 = 24.67
      // Total = 299 + 0 + 24.67 = 323.67
      const summary = calculateCartSummary(items);
      expect(summary.itemCount).toBe(1);
      expect(summary.subtotal).toBe(299.00);
      expect(summary.discountAmount).toBe(0);
      expect(summary.shipping).toBe(0);
      expect(summary.tax).toBe(24.67);
      expect(summary.total).toBe(323.67);
    });

    it('includes standard shipping fee when under threshold', () => {
      const items: CartItemInput[] = [
        { productId: 'sku-case', name: 'Protective Case', price: 40.00, quantity: 2 }
      ];

      // Subtotal = 80.00 (<150 -> shipping = 15)
      // Tax = 80 * 0.0825 = 6.60
      // Total = 80 + 15 + 6.60 = 101.60
      const summary = calculateCartSummary(items);
      expect(summary.subtotal).toBe(80.00);
      expect(summary.shipping).toBe(15.00);
      expect(summary.tax).toBe(6.60);
      expect(summary.total).toBe(101.60);
    });
  });
});
