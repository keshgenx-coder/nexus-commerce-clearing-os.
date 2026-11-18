// NEXUS Real-Time Mock Exchange Rate Service
// Simulates an institutional FX clearing feed (e.g., CME / Reuters Interbank)

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'INR' | 'CAD' | 'AUD' | 'SGD' | 'CHF' | 'AED';

export interface CurrencyMetadata {
  code: CurrencyCode;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
  country: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMetadata> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', decimals: 2, country: 'United States' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', decimals: 2, country: 'European Union' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', decimals: 2, country: 'United Kingdom' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', decimals: 0, country: 'Japan' },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', decimals: 2, country: 'India' },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', flag: '🇨🇦', decimals: 2, country: 'Canada' },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'AU$', flag: '🇦🇺', decimals: 2, country: 'Australia' },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'SG$', flag: '🇸🇬', decimals: 2, country: 'Singapore' },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF ', flag: '🇨🇭', decimals: 2, country: 'Switzerland' },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'AED ', flag: '🇦🇪', decimals: 2, country: 'United Arab Emirates' },
};

// Base exchange rates relative to 1 USD
export const BASE_RATES: Record<CurrencyCode, number> = {
  USD: 1.0000,
  EUR: 0.9245,
  GBP: 0.7880,
  JPY: 154.65,
  INR: 84.380,
  CAD: 1.3860,
  AUD: 1.5240,
  SGD: 1.3420,
  CHF: 0.8840,
  AED: 3.6725,
};

// 24h Rate Delta (Simulated market volatility)
export const BASE_DELTAS: Record<CurrencyCode, number> = {
  USD: 0.00,
  EUR: +0.14,
  GBP: -0.08,
  JPY: +0.32,
  INR: -0.05,
  CAD: +0.18,
  AUD: -0.22,
  SGD: +0.06,
  CHF: +0.11,
  AED: +0.01,
};

export interface ExchangeRateResponse {
  base: 'USD';
  timestamp: string;
  rates: Record<CurrencyCode, number>;
  deltas: Record<CurrencyCode, number>;
  feedProvider: string;
  latencyMs: number;
  status: 'SYNCHRONIZED' | 'DRIFT_DETECTED' | 'CIRCUIT_BREAK_ACTIVE';
}

class MockExchangeRateService {
  private currentRates: Record<CurrencyCode, number> = { ...BASE_RATES };
  private currentDeltas: Record<CurrencyCode, number> = { ...BASE_DELTAS };
  private lastFetched: Date = new Date();

  /**
   * Simulates an async API call to institutional FX liquidity clearing feeds
   */
  async fetchLiveRates(): Promise<ExchangeRateResponse> {
    // Artificial 200ms latency simulation
    await new Promise((resolve) => setTimeout(resolve, 220));

    // Introduce realistic micro-drift (±0.05% jitter on refresh to simulate living FX feed)
    const updatedRates: Record<CurrencyCode, number> = { ...this.currentRates };
    const updatedDeltas: Record<CurrencyCode, number> = { ...this.currentDeltas };

    (Object.keys(BASE_RATES) as CurrencyCode[]).forEach((code) => {
      if (code === 'USD') return;
      const jitter = (Math.random() - 0.5) * 0.001; // ±0.05%
      const newRate = Number((BASE_RATES[code] * (1 + jitter)).toFixed(code === 'JPY' ? 2 : 4));
      updatedRates[code] = newRate;
      const deltaShift = (Math.random() - 0.5) * 0.04;
      updatedDeltas[code] = Number((BASE_DELTAS[code] + deltaShift).toFixed(2));
    });

    this.currentRates = updatedRates;
    this.currentDeltas = updatedDeltas;
    this.lastFetched = new Date();

    return {
      base: 'USD',
      timestamp: this.lastFetched.toISOString(),
      rates: { ...this.currentRates },
      deltas: { ...this.currentDeltas },
      feedProvider: 'NEXUS Autonomous FX Clearing Feed · CME/Reuters Direct',
      latencyMs: Math.floor(10 + Math.random() * 8),
      status: 'SYNCHRONIZED'
    };
  }

  getCurrentRates(): Record<CurrencyCode, number> {
    return { ...this.currentRates };
  }

  getCurrentDeltas(): Record<CurrencyCode, number> {
    return { ...this.currentDeltas };
  }

  getLastFetchedTime(): Date {
    return this.lastFetched;
  }

  /**
   * Convert an amount from USD base into the target currency
   */
  convertFromUSD(amountInUSD: number, targetCurrency: CurrencyCode): number {
    const rate = this.currentRates[targetCurrency] || 1;
    const converted = amountInUSD * rate;
    const decimals = CURRENCIES[targetCurrency]?.decimals ?? 2;
    return Number(converted.toFixed(decimals));
  }

  /**
   * Format a USD price into the target currency with proper symbol, separators, and decimals
   */
  formatPrice(
    amountInUSD: number,
    targetCurrency: CurrencyCode,
    options?: {
      showCode?: boolean;
      compact?: boolean;
      maximumFractionDigits?: number;
    }
  ): string {
    const meta = CURRENCIES[targetCurrency] || CURRENCIES.USD;
    const converted = this.convertFromUSD(amountInUSD, targetCurrency);
    const decimals = options?.maximumFractionDigits !== undefined ? options.maximumFractionDigits : meta.decimals;

    let formattedNumber: string;

    if (options?.compact && Math.abs(converted) >= 1000) {
      if (Math.abs(converted) >= 1_000_000) {
        formattedNumber = (converted / 1_000_000).toFixed(1) + 'M';
      } else {
        formattedNumber = (converted / 1_000).toFixed(1) + 'k';
      }
    } else {
      formattedNumber = converted.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }

    if (options?.showCode) {
      return `${meta.symbol}${formattedNumber} ${meta.code}`;
    }

    return `${meta.symbol}${formattedNumber}`;
  }
}

export const currencyService = new MockExchangeRateService();
