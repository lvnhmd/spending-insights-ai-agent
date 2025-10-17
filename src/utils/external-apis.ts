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

// Load feature flags from config
function loadFeatureFlags(): FeatureFlags {
  try {
    const configPath = path.join(process.cwd(), 'config', 'feature-flags.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.warn('Could not load feature flags, using defaults:', error);
    return {
      USE_CACHED_APIS: true,
      MODEL_TIER: 'haiku',
      ENABLE_PLAID: false,
      ENABLE_ALPHA_VANTAGE: true,
      ENABLE_FRED: false,
      CACHE_DIRECTORY: './cache',
      API_TIMEOUT_MS: 5000,
      MAX_RETRIES: 3,
      DEMO_MODE: true
    };
  }
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

// Cache utilities
function getCachedData<T>(cacheKey: string): T | null {
  try {
    const cachePath = path.join(process.cwd(), featureFlags.CACHE_DIRECTORY, `${cacheKey}.json`);
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`Failed to read cached data for ${cacheKey}:`, error);
  }
  return null;
}

function setCachedData<T>(cacheKey: string, data: T): void {
  try {
    const cacheDir = path.join(process.cwd(), featureFlags.CACHE_DIRECTORY, path.dirname(cacheKey));
    const cachePath = path.join(process.cwd(), featureFlags.CACHE_DIRECTORY, `${cacheKey}.json`);
    
    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn(`Failed to cache data for ${cacheKey}:`, error);
  }
}

// Plaid API integration
export class PlaidClient {
  private apiKey: string;
  private environment: string;

  constructor(apiKey?: string, environment: string = 'sandbox') {
    this.apiKey = apiKey || process.env.PLAID_API_KEY || 'demo_key';
    this.environment = environment;
  }

  async getTransactions(userId: string, startDate?: string, endDate?: string): Promise<PlaidResponse> {
    const cacheKey = `plaid/transactions`;
    
    // Use cached data if feature flag is enabled or in demo mode
    if (featureFlags.USE_CACHED_APIS || featureFlags.DEMO_MODE || !featureFlags.ENABLE_PLAID) {
      const cachedData = getCachedData<PlaidResponse>(cacheKey);
      if (cachedData) {
        console.log('Using cached Plaid transaction data');
        return cachedData;
      }
    }

    // If Plaid is disabled, return cached data or throw error
    if (!featureFlags.ENABLE_PLAID) {
      const cachedData = getCachedData<PlaidResponse>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      throw new Error('Plaid API is disabled and no cached data available');
    }

    try {
      // In a real implementation, this would make actual API calls to Plaid
      // For demo purposes, we'll simulate the API call and return cached data
      console.log('Simulating Plaid API call...');
      
      const mockResponse: PlaidResponse = {
        accounts: [],
        transactions: [],
        total_transactions: 0,
        request_id: `mock_${Date.now()}`
      };

      // Cache the response
      setCachedData(cacheKey, mockResponse);
      return mockResponse;
    } catch (error) {
      console.error('Plaid API error:', error);
      
      // Fallback to cached data
      const cachedData = getCachedData<PlaidResponse>(cacheKey);
      if (cachedData) {
        console.log('Falling back to cached Plaid data due to API error');
        return cachedData;
      }
      
      throw new Error(`Plaid API failed and no cached data available: ${error}`);
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
    const cacheKey = `alpha_vantage/${symbol}_daily`;
    
    // Use cached data if feature flag is enabled or in demo mode
    if (featureFlags.USE_CACHED_APIS || featureFlags.DEMO_MODE) {
      const cachedData = getCachedData<AlphaVantageDaily>(cacheKey);
      if (cachedData) {
        console.log(`Using cached Alpha Vantage data for ${symbol}`);
        return cachedData;
      }
    }

    // If Alpha Vantage is disabled, return cached data or throw error
    if (!featureFlags.ENABLE_ALPHA_VANTAGE) {
      const cachedData = getCachedData<AlphaVantageDaily>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      throw new Error('Alpha Vantage API is disabled and no cached data available');
    }

    try {
      // In a real implementation, this would make actual API calls to Alpha Vantage
      // For demo purposes, we'll simulate the API call and return cached data
      console.log(`Simulating Alpha Vantage API call for ${symbol}...`);
      
      const mockResponse: AlphaVantageDaily = {
        'Meta Data': {
          '1. Information': 'Daily Prices (open, high, low, close) and Volumes',
          '2. Symbol': symbol,
          '3. Last Refreshed': new Date().toISOString().split('T')[0],
          '4. Output Size': 'Compact',
          '5. Time Zone': 'US/Eastern'
        },
        'Time Series (Daily)': {}
      };

      // Cache the response
      setCachedData(cacheKey, mockResponse);
      return mockResponse;
    } catch (error) {
      console.error('Alpha Vantage API error:', error);
      
      // Fallback to cached data
      const cachedData = getCachedData<AlphaVantageDaily>(cacheKey);
      if (cachedData) {
        console.log(`Falling back to cached Alpha Vantage data for ${symbol} due to API error`);
        return cachedData;
      }
      
      throw new Error(`Alpha Vantage API failed and no cached data available: ${error}`);
    }
  }

  async getMarketOverview(): Promise<any> {
    const cacheKey = 'alpha_vantage/market_overview';
    
    if (featureFlags.USE_CACHED_APIS || featureFlags.DEMO_MODE) {
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        console.log('Using cached market overview data');
        return cachedData;
      }
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

    setCachedData(cacheKey, mockOverview);
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