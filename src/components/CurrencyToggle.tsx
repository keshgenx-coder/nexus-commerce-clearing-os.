import React, { useState, useRef, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { audioVibe } from '../utils/audioVibe';
import { 
  Globe, 
  ChevronDown, 
  Check, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Radio, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { CurrencyCode } from '../services/currencyService';

interface CurrencyToggleProps {
  variant?: 'compact' | 'detailed';
  className?: string;
}

export const CurrencyToggle: React.FC<CurrencyToggleProps> = ({ 
  variant = 'compact',
  className = ''
}) => {
  const { 
    currency, 
    setCurrency, 
    rates, 
    rateDeltas, 
    isLoadingRates, 
    lastUpdated, 
    refreshRates, 
    availableCurrencies, 
    currencyInfo,
    latencyMs
  } = useCurrency();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: CurrencyCode) => {
    audioVibe.playClick();
    setCurrency(code);
    setIsOpen(false);
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    audioVibe.playSoftPop();
    await refreshRates();
    audioVibe.playChimeSuccess();
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => {
          audioVibe.playClick();
          setIsOpen(!isOpen);
        }}
        className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-sm group select-none"
        title="Change Global Pricing & Clearing Currency"
        aria-expanded={isOpen}
      >
        <span className="text-emerald-400 font-bold tabular-nums">{currencyInfo.symbol}</span>
        <span className="font-bold text-white tracking-wide">{currencyInfo.code}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : 'group-hover:text-slate-200'}`} />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-[#0B0F17] border border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-black/60 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                  REAL-TIME FX CLEARING FEED
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 text-[9px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {latencyMs}ms
                </span>
              </div>
              <div className="text-[11px] font-sans text-slate-300 mt-0.5">
                Base USD · CME / Interbank Benchmark
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isLoadingRates}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Live Exchange Rates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRates ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Currencies Grid */}
          <div className="p-2 max-h-80 overflow-y-auto space-y-1 scrollbar-thin">
            {availableCurrencies.map((c) => {
              const isSelected = c.code === currency;
              const rate = rates[c.code] ?? 1;
              const delta = rateDeltas[c.code] ?? 0;
              const isPositive = delta >= 0;

              return (
                <button
                  key={c.code}
                  onClick={() => handleSelect(c.code)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? 'bg-slate-800/90 text-white border border-emerald-500/50 shadow-sm'
                      : 'hover:bg-slate-900/80 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base select-none">{c.flag}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">{c.code}</span>
                        <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">• {c.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 tabular-nums">
                        {c.code === 'USD' ? (
                          <span className="text-emerald-400 font-bold">1.0000 (Base Peg)</span>
                        ) : (
                          <span>1 USD = {rate.toLocaleString(undefined, { minimumFractionDigits: c.decimals, maximumFractionDigits: 4 })} {c.symbol.trim()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {c.code !== 'USD' && (
                      <span className={`text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                        isPositive 
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60' 
                          : 'bg-amber-950/60 text-amber-400 border border-amber-900/60'
                      }`}>
                        {isPositive ? `+${delta}%` : `${delta}%`}
                      </span>
                    )}

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/80 flex items-center justify-center text-emerald-400 shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-black/80 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 px-3">
            <span>Synchronized {lastUpdated.toLocaleTimeString()}</span>
            <span className="text-emerald-400 font-semibold">Active: {currencyInfo.code} ({currencyInfo.symbol})</span>
          </div>
        </div>
      )}
    </div>
  );
};
