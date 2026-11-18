import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  CurrencyCode, 
  CurrencyMetadata, 
  CURRENCIES, 
  currencyService, 
  ExchangeRateResponse 
} from '../services/currencyService';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  rates: Record<CurrencyCode, number>;
  rateDeltas: Record<CurrencyCode, number>;
  isLoadingRates: boolean;
  lastUpdated: Date;
  refreshRates: () => Promise<void>;
  convertPrice: (amountInUSD: number) => number;
  formatPrice: (amountInUSD: number, options?: { showCode?: boolean; compact?: boolean; maximumFractionDigits?: number }) => string;
  symbol: string;
  currencyInfo: CurrencyMetadata;
  availableCurrencies: CurrencyMetadata[];
  latencyMs: number;
  provider: string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const STORAGE_KEY = 'nexus_currency_preference';

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode;
      if (saved && CURRENCIES[saved]) return saved;
    } catch {
      // Fallback
    }
    return 'USD';
  });

  const [rates, setRates] = useState<Record<CurrencyCode, number>>(currencyService.getCurrentRates());
  const [rateDeltas, setRateDeltas] = useState<Record<CurrencyCode, number>>(currencyService.getCurrentDeltas());
  const [lastUpdated, setLastUpdated] = useState<Date>(currencyService.getLastFetchedTime());
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [latencyMs, setLatencyMs] = useState(12);
  const [provider, setProvider] = useState('NEXUS Autonomous FX Clearing Feed · CME/Reuters Direct');

  const setCurrency = useCallback((code: CurrencyCode) => {
    if (CURRENCIES[code]) {
      setCurrencyState(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        // ignore
      }
    }
  }, []);

  const refreshRates = useCallback(async () => {
    setIsLoadingRates(true);
    try {
      const res: ExchangeRateResponse = await currencyService.fetchLiveRates();
      setRates(res.rates);
      setRateDeltas(res.deltas);
      setLastUpdated(new Date(res.timestamp));
      setLatencyMs(res.latencyMs);
      setProvider(res.feedProvider);
    } finally {
      setIsLoadingRates(false);
    }
  }, []);

  const convertPrice = useCallback((amountInUSD: number) => {
    return currencyService.convertFromUSD(amountInUSD, currency);
  }, [currency]);

  const formatPrice = useCallback((
    amountInUSD: number,
    options?: { showCode?: boolean; compact?: boolean; maximumFractionDigits?: number }
  ) => {
    return currencyService.formatPrice(amountInUSD, currency, options);
  }, [currency]);

  const currencyInfo = CURRENCIES[currency] || CURRENCIES.USD;
  const availableCurrencies = Object.values(CURRENCIES);

  const value: CurrencyContextType = {
    currency,
    setCurrency,
    rates,
    rateDeltas,
    isLoadingRates,
    lastUpdated,
    refreshRates,
    convertPrice,
    formatPrice,
    symbol: currencyInfo.symbol,
    currencyInfo,
    availableCurrencies,
    latencyMs,
    provider
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
