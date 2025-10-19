// External API utilities for weekly insights generator
// Simplified version with only what we need

export interface PlaidTransaction {
  account_id: string;
  amount: number;
  iso_currency_code: string;
  category: string[];
  category_id: string;
  date: string;
  datetime: string;
  merchant_name: string;
  name: string;
  transaction_id: string;
  transaction_type: string;
}

export interface PlaidAccount {
  account_id: string;
  balances: {
    available: number;
    current: number;
    limit: number | null;
    iso_currency_code: string;
  };
  mask: string;
  name: string;
  official_name: string;
  subtype: string;
  type: string;
}

export interface PlaidResponse {
  accounts: PlaidAccount[];
  transactions: PlaidTransaction[];
  total_transactions: number;
  request_id: string;
}

// Feature flags for this Lambda
export const featureFlags = {
  USE_CACHED_APIS: process.env.USE_CACHED_APIS === 'true' || true,
  DEMO_MODE: process.env.DEMO_MODE === 'true' || true,
  ENABLE_PLAID: process.env.ENABLE_PLAID === 'true' || false
};