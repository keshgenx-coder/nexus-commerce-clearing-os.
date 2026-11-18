import { describe, it, expect } from 'vitest';
import {
  applyDiscount,
  calculateCartSummary,
  STANDARD_DISCOUNTS,
  CartItemInput
} from '../src/utils/commerceLogic';

describe('Commerce Suite: Discount & Coupon Engine', () => {
  describe('applyDiscount - Basic Rules', () => {
    it('applies percentage discounts correctly', () => {
      // 10% off $200 = $20
      const res10 = applyDiscount(200.00, 'DISCOUNT10');
      expect(res10.isValid).toBe(true);
      expect(res10.discountAmount).toBe(20.00);
      expect(res10.code).toBe('DISCOUNT10');

      // 20% off $350 = $70
      const res20 = applyDiscount(350.00, 'DISCOUNT20');
      expect(res20.isValid).toBe(true);
      expect(res20.discountAmount).toBe(70.00);
    });

    it('handles case-insensitivity and whitespace in coupon input', () => {
      const lower = applyDiscount(100.00, 'discount20 ');
      expect(lower.isValid).toBe(true);
      expect(lower.discountAmount).toBe(20.00);
      expect(lower.code).toBe('DISCOUNT20');
    });

    it('rejects unknown or invalid coupon codes', () => {
      const invalid = applyDiscount(200.00, 'FAKECODE999');
      expect(invalid.isValid).toBe(false);
      expect(invalid.discountAmount).toBe(0);
      expect(invalid.error).toContain('Invalid or unrecognized');
    });

    it('enforces minimum order spend hurdles', () => {
      // WELCOME50 requires min $200 order
      const subUnder = applyDiscount(150.00, 'WELCOME50');
      expect(subUnder.isValid).toBe(false);
      expect(subUnder.discountAmount).toBe(0);
      expect(subUnder.error).toContain('Minimum order amount of $200 required');

      const subMet = applyDiscount(250.00, 'WELCOME50');
      expect(subMet.isValid).toBe(true);
      expect(subMet.discountAmount).toBe(50.00);
    });

    it('enforces maximum discount caps', () => {
      // VIP30 is 30% capped at max $150
      // 30% of $1,000 = $300 -> capped at $150
      const capped = applyDiscount(1000.00, 'VIP30');
      expect(capped.isValid).toBe(true);
      expect(capped.discountAmount).toBe(150.00);
    });

    it('never allows discount amount to exceed subtotal', () => {
      const customDiscounts = {
        'SUPER999': { code: 'SUPER999', type: 'fixed' as const, value: 500 }
      };
      const res = applyDiscount(100.00, 'SUPER999', customDiscounts);
      expect(res.isValid).toBe(true);
      expect(res.discountAmount).toBe(100.00); // Clamped to $100 subtotal
    });
  });

  describe('applyDiscount - Margin Floor Guardrail Protection', () => {
    it('restricts discount if it would breach the mandatory gross margin floor', () => {
      // Scenario:
      // Subtotal = $200.00
      // COGS = $150.00
      // Mandatory Margin Floor = 20%
      // Required Minimum Revenue: COGS / (1 - 0.20) = $150 / 0.8 = $187.50
      // Maximum Allowable Discount: $200 - $187.50 = $12.50
      // Attempted discount: DISCOUNT20 (20% of $200 = $40.00)
      // Without guardrail: $40 discount -> $160 revenue -> ($160 - $150)/$160 = 6.25% margin (VIOLATION!)
      // With guardrail: Discount is clamped to $12.50 to preserve 20% margin!
      
      const res = applyDiscount(200.00, 'DISCOUNT20', STANDARD_DISCOUNTS, 150.00, 20.0);
      expect(res.isValid).toBe(true);
      expect(res.discountAmount).toBe(12.50);
      
      const revenue = 200.00 - res.discountAmount;
      const margin = ((revenue - 150.00) / revenue) * 100;
      expect(margin).toBeGreaterThanOrEqual(19.99); // 20% preserved
    });
  });

  describe('calculateCartSummary with Discounts', () => {
    it('accurately applies valid discount to composite cart and calculates net tax', () => {
      const items: CartItemInput[] = [
        { productId: 'p1', name: 'Audio Hub', price: 250.00, quantity: 1 }
      ];

      // Subtotal = $250.00
      // DISCOUNT20 = 20% off = $50.00 discount
      // Taxable amount = $200.00
      // Subtotal was $250 (>150) -> shipping = $0
      // Tax = $200 * 0.0825 = $16.50
      // Total = 200 + 0 + 16.50 = $216.50
      const summary = calculateCartSummary(items, 'DISCOUNT20');
      expect(summary.subtotal).toBe(250.00);
      expect(summary.discountAmount).toBe(50.00);
      expect(summary.discountCode).toBe('DISCOUNT20');
      expect(summary.shipping).toBe(0);
      expect(summary.tax).toBe(16.50);
      expect(summary.total).toBe(216.50);
    });

    it('ignores invalid coupons and retains full subtotal', () => {
      const items: CartItemInput[] = [
        { productId: 'p1', name: 'Standard Item', price: 100.00, quantity: 1 }
      ];

      const summary = calculateCartSummary(items, 'NONEXISTENT_CODE');
      expect(summary.discountAmount).toBe(0);
      expect(summary.discountCode).toBeUndefined();
      expect(summary.subtotal).toBe(100.00);
    });
  });
});
