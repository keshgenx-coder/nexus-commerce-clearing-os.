import { describe, it, expect } from 'vitest';
import {
  validateOrderPayload,
  calculateFraudRisk,
  generateOrderTrackingNumber,
  CreateOrderInput
} from '../src/utils/commerceLogic';

describe('Commerce Suite: Order Placement & Validation', () => {
  const validBaseOrder: CreateOrderInput = {
    customerName: 'Sarah Connor',
    customerEmail: 'sarah.connor@cyberdyne.org',
    customerPhone: '+1 (555) 019-2831',
    shippingAddress: '100 Tech Boulevard, Austin, TX 78701',
    paymentMethod: 'credit_card',
    channel: 'web',
    items: [
      {
        productId: 'sku-nx-anc-09',
        productName: 'NEXUS ANC Flagship Audio',
        price: 299.00,
        quantity: 1
      }
    ]
  };

  describe('validateOrderPayload', () => {
    it('validates a well-formed enterprise order successfully', () => {
      const result = validateOrderPayload(validBaseOrder);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects order with missing customer name', () => {
      const order = { ...validBaseOrder, customerName: '   ' };
      const result = validateOrderPayload(order);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Customer name is required');
    });

    it('rejects order with invalid email address format', () => {
      const order = { ...validBaseOrder, customerEmail: 'not-an-email' };
      const result = validateOrderPayload(order);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid customer email is required');
    });

    it('rejects order with missing shipping address', () => {
      const order = { ...validBaseOrder, shippingAddress: '' };
      const result = validateOrderPayload(order);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Shipping address is required');
    });

    it('rejects order with empty items list', () => {
      const order = { ...validBaseOrder, items: [] };
      const result = validateOrderPayload(order);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Order must contain at least one item');
    });

    it('rejects item with non-positive quantity or negative price', () => {
      const order = {
        ...validBaseOrder,
        items: [
          { productId: 'p1', productName: 'Item 1', price: 100, quantity: 0 },
          { productId: 'p2', productName: 'Item 2', price: -50, quantity: 1 }
        ]
      };
      const result = validateOrderPayload(order);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Item 1: quantity must be greater than zero',
          'Item 2: price cannot be negative'
        ])
      );
    });
  });

  describe('calculateFraudRisk', () => {
    it('assigns LOW risk score to standard credit card web orders', () => {
      const risk = calculateFraudRisk(validBaseOrder);
      expect(risk.level).toBe('LOW');
      expect(risk.score).toBeLessThanOrEqual(25);
      expect(risk.flags).toHaveLength(0);
    });

    it('flags cryptocurrency payments with elevated risk score', () => {
      const cryptoOrder: CreateOrderInput = {
        ...validBaseOrder,
        paymentMethod: 'crypto'
      };
      const risk = calculateFraudRisk(cryptoOrder);
      expect(risk.score).toBeGreaterThanOrEqual(50);
      expect(risk.flags).toContain('CRYPTOCURRENCY_PAYMENT_METHOD');
    });

    it('flags high value transactions (> $2,000)', () => {
      const bulkOrder: CreateOrderInput = {
        ...validBaseOrder,
        items: [
          { productId: 'p1', productName: 'Bulk Lots', price: 500, quantity: 5 } // $2,500
        ]
      };
      const risk = calculateFraudRisk(bulkOrder);
      expect(risk.flags).toContain('HIGH_VALUE_TRANSACTION');
    });

    it('flags disposable temporary email domains with HIGH risk level', () => {
      const suspiciousOrder: CreateOrderInput = {
        ...validBaseOrder,
        customerEmail: 'burner8812@temporarymail.org',
        paymentMethod: 'crypto'
      };
      const risk = calculateFraudRisk(suspiciousOrder);
      expect(risk.level).toBe('HIGH');
      expect(risk.flags).toContain('DISPOSABLE_EMAIL_DOMAIN');
      expect(risk.flags).toContain('CRYPTOCURRENCY_PAYMENT_METHOD');
    });
  });

  describe('generateOrderTrackingNumber', () => {
    it('generates a formatted tracking code with NX prefix and US suffix', () => {
      const tracking = generateOrderTrackingNumber('NX');
      expect(tracking).toMatch(/^NX-\d{9}-US$/);
    });

    it('generates unique tracking numbers across multiple calls', () => {
      const track1 = generateOrderTrackingNumber();
      const track2 = generateOrderTrackingNumber();
      expect(track1).not.toBe(track2);
    });
  });
});
