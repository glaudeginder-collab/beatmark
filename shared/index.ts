// BeatMark — Shared TypeScript Types
// Single source of truth for frontend + backend contracts

export interface HoldingInput {
  id: string;           // Client-generated UUID
  name: string;         // e.g. "Fundsmith Equity T Acc"
  amountInvested: number; // GBP — original cost basis (> 0)
  currentValue: number;   // GBP — current market value (>= 0)
  purchaseDate: string;   // YYYY-MM-DD
}

export interface CalculateRequest {
  holdings: HoldingInput[];
  currency: 'GBP';
}

export interface PricePoint {
  date: string;   // YYYY-MM-DD
  close: number;  // Adjusted close in GBP
}

export interface HoldingResult {
  id: string;
  name: string;
  amountInvested: number;
  currentValue: number;
  purchaseDate: string;
  totalReturn: number;           // % e.g. 12.5 = +12.5%
  totalReturnAbsolute: number;   // GBP
  vwrlReturn: number;            // % VWRL same period
  vwrlReturnAbsolute: number;    // GBP
  vwrlEquivalentValue: number;   // What amountInvested in VWRL would be worth
  outperformance: number;        // totalReturn - vwrlReturn
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalReturn: number;
  totalReturnAbsolute: number;
}

export interface BenchmarkSummary {
  ticker: 'VWRL.L';
  name: 'Vanguard FTSE All-World UCITS ETF';
  totalEquivalentValue: number;
  totalReturn: number;
  totalReturnAbsolute: number;
}

export interface ComparisonSummary {
  outperformance: number;
  outperformanceAbsolute: number;
  verdict: 'beating' | 'trailing' | 'matching';
}

export type WarningCode =
  | 'PURCHASE_DATE_ADJUSTED'
  | 'NEAR_LISTING_DATE'
  | 'CURRENT_VALUE_ZERO'
  | 'SINGLE_DAY_RANGE'
  | 'DATA_MAY_BE_STALE';

export interface Warning {
  code: WarningCode;
  holdingId?: string;
  message: string;
}

export interface CalculateResponse {
  holdings: HoldingResult[];
  portfolio: PortfolioSummary;
  benchmark: BenchmarkSummary;
  comparison: ComparisonSummary;
  calculatedAt: string;
  dataAsOf: string;
  warnings: Warning[];
}

export interface VwrlPricesResponse {
  ticker: 'VWRL.L';
  name: 'Vanguard FTSE All-World UCITS ETF';
  currency: 'GBP';
  prices: PricePoint[];
  dataAsOf: string;
  cachedAt: string;
}

export interface ApiError {
  code: string;
  message: string;
}
