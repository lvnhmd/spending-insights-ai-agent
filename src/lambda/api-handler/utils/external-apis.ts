import * as fs from 'fs';
import * as path from 'path';

// Feature flags configuration
interface FeatureFlags {
  USE_CACHED_APIS: boolean;
  MODEL_TIER: 'haiku' | 'sonnet';
  ENABLE_PLAID: boolean;
  ENABLE_ALPHA_VANTAGE: boolean;
  ENABLE_FRED: boolean;
  CACHE_DIRECTORY: string;
  API_TIMEOUT_MS: number;
  MAX_RETRIES: number;
  DEMO_MODE: boolean;
}

// Load feature flags from environment or defaults
function loadFeatureFlags(): FeatureFlags {
  return {
    USE_CACHED_APIS: process.env.USE_CACHED_APIS === 'true' || true,
    MODEL_TIER: (process.env.MODEL_TIER as 'haiku' | 'sonnet') || 'haiku',
    ENABLE_PLAID: process.env.ENABLE_PLAID === 'true' || false,
    ENABLE_ALPHA_VANTAGE: process.env.ENABLE_ALPHA_VANTAGE === 'true' || true,
    ENABLE_FRED: process.env.ENABLE_FRED === 'true' || false,
    CACHE_DIRECTORY: process.env.CACHE_DIRECTORY || '/tmp/cache',
    API_TIMEOUT_MS: parseInt(process.env.API_TIMEOUT_MS || '5000'),
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
    DEMO_MODE: process.env.DEMO_MODE === 'true' || true
  };
}

export const featureFlags = loadFeatureFlags();

// Plaid API types
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

// Alpha Vantage API types
export interface AlphaVantageDaily {
  'Meta Data': {
    '1. Information': string;
    '2. Symbol': string;
    '3. Last Refreshed': string;
    '4. Output Size': string;
    '5. Time Zone': string;
  };
  'Time Series (Daily)': {
    [date: string]: {
      '1. open': string;
      '2. high': string;
      '3. low': string;
      '4. close': string;
      '5. volume': string;
    };
  };
}

// Cached data for Lambda environment (embedded in code for reliability)
const CACHED_PLAID_DATA: PlaidResponse = {
  "accounts": [
    {
      "account_id": "demo_checking_001",
      "balances": {
        "available": 2500.75,
        "current": 2500.75,
        "limit": null,
        "iso_currency_code": "USD"
      },
      "mask": "0000",
      "name": "Demo Checking Account",
      "official_name": "Demo Bank Checking Account",
      "subtype": "checking",
      "type": "depository"
    },
    {
      "account_id": "demo_credit_001",
      "balances": {
        "available": 1200.00,
        "current": -850.25,
        "limit": 2000.00,
        "iso_currency_code": "USD"
      },
      "mask": "1234",
      "name": "Demo Credit Card",
      "official_name": "Demo Bank Credit Card",
      "subtype": "credit card",
      "type": "credit"
    }
  ],
  "transactions": [
    {
      "account_id": "demo_checking_001",
      "amount": 12.99,
      "iso_currency_code": "USD",
      "category": ["Entertainment", "Streaming Services"],
      "category_id": "17001013",
      "date": "2024-01-15",
      "datetime": "2024-01-15T10:30:00Z",
      "merchant_name": "StreamCo Premium",
      "name": "STREAMCO PREMIUM MONTHLY",
      "transaction_id": "demo_tx_001",
      "transaction_type": "digital"
    },
    {
      "account_id": "demo_checking_001",
      "amount": 89.50,
      "iso_currency_code": "USD",
      "category": ["Shops", "Supermarkets and Groceries"],
      "category_id": "19047000",
      "date": "2024-01-14",
      "datetime": "2024-01-14T15:45:00Z",
      "merchant_name": "Fresh Market",
      "name": "FRESH MARKET #001",
      "transaction_id": "demo_tx_002",
      "transaction_type": "place"
    },
    {
      "account_id": "demo_credit_001",
      "amount": 45.00,
      "iso_currency_code": "USD",
      "category": ["Service", "Financial", "Banking Fees"],
      "category_id": "16001000",
      "date": "2024-01-13",
      "datetime": "2024-01-13T09:00:00Z",
      "merchant_name": "Demo Bank",
      "name": "OVERDRAFT FEE",
      "transaction_id": "demo_tx_003",
      "transaction_type": "special"
    },
    {
      "account_id": "demo_checking_001",
      "amount": 9.99,
      "iso_currency_code": "USD",
      "category": ["Entertainment", "Streaming Services"],
      "category_id": "17001013",
      "date": "2024-01-12",
      "datetime": "2024-01-12T08:15:00Z",
      "merchant_name": "MusicStream",
      "name": "MUSICSTREAM FAMILY PLAN",
      "transaction_id": "demo_tx_004",
      "transaction_type": "digital"
    },
    {
      "account_id": "demo_checking_001",
      "amount": 156.78,
      "iso_currency_code": "USD",
      "category": ["Shops", "Department Stores"],
      "category_id": "19013000",
      "date": "2024-01-11",
      "datetime": "2024-01-11T14:20:00Z",
      "merchant_name": "Target",
      "name": "TARGET STORE #025",
      "transaction_id": "demo_tx_005",
      "transaction_type": "place"
    }
  ],
  "total_transactions": 5,
  "request_id": "demo_request_001"
};

const CACHED_ALPHA_VANTAGE_DATA: AlphaVantageDaily = {
  "Meta Data": {
    "1. Information": "Daily Prices (open, high, low, close) and Volumes",
    "2. Symbol": "AAPL",
    "3. Last Refreshed": "2024-01-16",
    "4. Output Size": "Compact",
    "5. Time Zone": "US/Eastern"
  },
  "Time Series (Daily)": {
    "2024-01-16": {
      "1. open": "182.16",
      "2. high": "184.26",
      "3. low": "180.93",
      "4. close": "183.63",
      "5. volume": "65573200"
    },
    "2024-01-12": {
      "1. open": "181.27",
      "2. high": "182.76",
      "3. low": "180.13",
      "4. close": "181.91",
      "5. volume": "58953200"
    },
    "2024-01-11": {
      "1. open": "180.21",
      "2. high": "181.92",
      "3. low": "179.27",
      "4. close": "180.17",
      "5. volume": "51814200"
    },
    "2024-01-10": {
      "1. open": "179.33",
      "2. high": "180.85",
      "3. low": "177.07",
      "4. close": "179.58",
      "5. volume": "58953200"
    },
    "2024-01-09": {
      "1. open": "178.53",
      "2. high": "179.83",
      "3. low": "177.26",
      "4. close": "178.85",
      "5. volume": "42841900"
    }
  }
};

// Plaid API integration
export class PlaidClient {
  private apiKey: string;
  private environment: string;

  constructor(apiKey?: string, environment: string = 'sandbox') {
    this.apiKey = apiKey || process.env.PLAID_API_KEY || 'demo_key';
    this.environment = environment;
  }

  async getTransactions(userId: string, startDate?: string, endDate?: string): Promise<PlaidResponse> {
    // Use cached data if feature flag is enabled or in demo mode
    if (featureFlags.USE_CACHED_APIS || featureFlags.DEMO_MODE || !featureFlags.ENABLE_PLAID) {
      console.log('Using cached Plaid transaction data');
      return CACHED_PLAID_DATA;
    }

    // If Plaid is disabled, return cached data
    if (!featureFlags.ENABLE_PLAID) {
      return CACHED_PLAID_DATA;
    }

    try {
      // In a real implementation, this would make actual API calls to Plaid
      // For demo purposes, we'll simulate the API call and return cached data
      console.log('Simulating Plaid API call...');
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return CACHED_PLAID_DATA;
    } catch (error) {
      console.error('Plaid API error:', error);
      
      // Fallback to cached data
      console.log('Falling back to cached Plaid data due to API error');
      return CACHED_PLAID_DATA;
    }
  }
}

// Alpha Vantage API integration
export class AlphaVantageClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ALPHA_VANTAGE_API_KEY || 'demo_key';
    this.baseUrl = 'https://www.alphavantage.co/query';
  }

  async getDailyPrices(symbol: string): Promise<AlphaVantageDaily> {
    // Use cached data if feature flag is enabled or in demo mode
    if (featureFlags.USE_CACHED_APIS || featureFlags.DEMO_MODE) {
      console.log(`Using cached Alpha Vantage data for ${symbol}`);
      return CACHED_ALPHA_VANTAGE_DATA;
    }

    // If Alpha Vantage is disabled, return cached data
    if (!featureFlags.ENABLE_ALPHA_VANTAGE) {
      return CACHED_ALPHA_VANTAGE_DATA;
    }

    try {
      // In a real implementation, this would make actual API calls to Alpha Vantage
      // For demo purposes, we'll simulate the API call and return cached data
      console.log(`Simulating Alpha Vantage API call for ${symbol}...`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 150));
      
      return CACHED_ALPHA_VANTAGE_DATA;
    } catch (error) {
      console.error('Alpha Vantage API error:', error);
      
      // Fallback to cached data
      console.log(`Falling back to cached Alpha Vantage data for ${symbol} due to API error`);
      return CACHED_ALPHA_VANTAGE_DATA;
    }
  }

  async getMarketOverview(): Promise<any> {
    if (featureFlags.USE_CACHED_APIS || featureFlags.DEMO_MODE) {
      console.log('Using cached market overview data');
    }

    // Return mock market data for demo
    const mockOverview = {
      market_status: 'open',
      last_updated: new Date().toISOString(),
      major_indices: {
        'S&P 500': { value: 4750.23, change: '+0.85%' },
        'NASDAQ': { value: 14820.45, change: '+1.12%' },
        'DOW': { value: 37650.12, change: '+0.45%' }
      }
    };

    return mockOverview;
  }
}

// Factory function to create API clients
export function createAPIClients() {
  return {
    plaid: new PlaidClient(),
    alphaVantage: new AlphaVantageClient()
  };
}

// Utility function to check if APIs are available
export function getAPIStatus() {
  return {
    plaid: {
      enabled: featureFlags.ENABLE_PLAID,
      cached: featureFlags.USE_CACHED_APIS,
      available: featureFlags.ENABLE_PLAID || featureFlags.USE_CACHED_APIS
    },
    alphaVantage: {
      enabled: featureFlags.ENABLE_ALPHA_VANTAGE,
      cached: featureFlags.USE_CACHED_APIS,
      available: featureFlags.ENABLE_ALPHA_VANTAGE || featureFlags.USE_CACHED_APIS
    },
    fred: {
      enabled: featureFlags.ENABLE_FRED,
      cached: featureFlags.USE_CACHED_APIS,
      available: false // Skipped as per requirements
    }
  };
}

// featureFlags already exported above