import { describe, it, expect } from 'vitest';
import {
  calculateMarginFloorPrice,
  evaluateMarginGuardrail
} from '../src/utils/commerceLogic';

describe('Commerce Suite: Margin Floor Guardrails & Circuit Breakers', () => {
  describe('calculateMarginFloorPrice (P_min Formulation)', () => {
    it('accurately computes absolute minimum clearing price from COGS and margin floor', () => {
      // Worked Enterprise Example from Technical Dossier:
      // COGS = $168.00, MarginFloor = 18.5%
      // P_min = 168.00 / (1 - 0.185) = 168.00 / 0.815 = 206.1349 -> $206.13
      const pMin = calculateMarginFloorPrice(168.00, 18.5);
      expect(pMin).toBe(206.13);
    });

    it('computes 38.0% margin floor correctly', () => {
      // COGS = $100.00, MarginFloor = 38%
      // P_min = 100 / (1 - 0.38) = 100 / 0.62 = $161.29
      const pMin = calculateMarginFloorPrice(100.00, 38.0);
      expect(pMin).toBe(161.29);
    });

    it('returns 0 if COGS is 0 or negative', () => {
      expect(calculateMarginFloorPrice(0, 20)).toBe(0);
      expect(calculateMarginFloorPrice(-50, 20)).toBe(0);
    });
  });

  describe('evaluateMarginGuardrail (Circuit Breaker Evaluation)', () => {
    const cogs = 168.00;
    const marginFloorPct = 18.5; // P_min is $206.13

    it('passes and clears transaction when price satisfies margin floor', () => {
      // Standard Retail Price: $299.00 (Well above $206.13 floor)
      const evalNominal = evaluateMarginGuardrail(cogs, marginFloorPct, 299.00);
      expect(evalNominal.passed).toBe(true);
      expect(evalNominal.circuitBreakerTripped).toBe(false);
      expect(evalNominal.realizedMarginPct).toBe(43.81); // (299 - 168)/299 = 43.81%
    });

    it('activates circuit breaker when predatory undercut breaches margin floor', () => {
      // Competitor predatory undercut at $195.00 (Below $206.13 minimum floor)
      // Without dynamic bundle, the system must trigger circuit breaker halt!
      const evalBreach = evaluateMarginGuardrail(cogs, marginFloorPct, 195.00);
      expect(evalBreach.passed).toBe(false);
      expect(evalBreach.circuitBreakerTripped).toBe(true);
      expect(evalBreach.reason).toContain('Circuit breaker activated');
      expect(evalBreach.minimumFloorPrice).toBe(206.13);
    });

    it('synthesizes dynamic bundle to overcome margin deficit and preserve profitability', () => {
      // Scenario: Competitor drops to $215.00.
      // While $215 is above raw $206.13, margin is only 21.8%.
      // Merchant attaches high-margin AeroShield Case (COGS $8.50) and sells bundle for $239.00:
      // Composite COGS = $168 + $8.50 = $176.50
      // Combined P_min = $176.50 / 0.815 = $216.56
      // Bundle Selling Price: $239.00 >= $216.56 -> PASS!
      // Realized Margin: ($239.00 - $176.50) / $239.00 = 26.15% margin
      const evalBundle = evaluateMarginGuardrail(cogs, marginFloorPct, 215.00, 8.50, 239.00);
      expect(evalBundle.passed).toBe(true);
      expect(evalBundle.circuitBreakerTripped).toBe(false);
      expect(evalBundle.bundleApplied).toBe(true);
      expect(evalBundle.attemptedPrice).toBe(239.00);
      expect(evalBundle.cogs).toBe(176.50);
      expect(evalBundle.realizedMarginPct).toBe(26.15);
    });
  });
});
