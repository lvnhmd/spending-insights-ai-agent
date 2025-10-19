"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlphaVantageClient = exports.PlaidClient = exports.featureFlags = void 0;
exports.createAPIClients = createAPIClients;
exports.getAPIStatus = getAPIStatus;
// Load feature flags from environment or defaults
function loadFeatureFlags() {
    return {
        USE_CACHED_APIS: process.env.USE_CACHED_APIS === 'true' || true,
        MODEL_TIER: process.env.MODEL_TIER || 'haiku',
        ENABLE_PLAID: process.env.ENABLE_PLAID === 'true' || false,
        ENABLE_ALPHA_VANTAGE: process.env.ENABLE_ALPHA_VANTAGE === 'true' || true,
        ENABLE_FRED: process.env.ENABLE_FRED === 'true' || false,
        CACHE_DIRECTORY: process.env.CACHE_DIRECTORY || '/tmp/cache',
        API_TIMEOUT_MS: parseInt(process.env.API_TIMEOUT_MS || '5000'),
        MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
        DEMO_MODE: process.env.DEMO_MODE === 'true' || true
    };
}
exports.featureFlags = loadFeatureFlags();
// Cached data for Lambda environment (embedded in code for reliability)
const CACHED_PLAID_DATA = {
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
const CACHED_ALPHA_VANTAGE_DATA = {
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
class PlaidClient {
    constructor(apiKey, environment = 'sandbox') {
        this.apiKey = apiKey || process.env.PLAID_API_KEY || 'demo_key';
        this.environment = environment;
    }
    async getTransactions(userId, startDate, endDate) {
        // Use cached data if feature flag is enabled or in demo mode
        if (exports.featureFlags.USE_CACHED_APIS || exports.featureFlags.DEMO_MODE || !exports.featureFlags.ENABLE_PLAID) {
            console.log('Using cached Plaid transaction data');
            return CACHED_PLAID_DATA;
        }
        // If Plaid is disabled, return cached data
        if (!exports.featureFlags.ENABLE_PLAID) {
            return CACHED_PLAID_DATA;
        }
        try {
            // In a real implementation, this would make actual API calls to Plaid
            // For demo purposes, we'll simulate the API call and return cached data
            console.log('Simulating Plaid API call...');
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 100));
            return CACHED_PLAID_DATA;
        }
        catch (error) {
            console.error('Plaid API error:', error);
            // Fallback to cached data
            console.log('Falling back to cached Plaid data due to API error');
            return CACHED_PLAID_DATA;
        }
    }
}
exports.PlaidClient = PlaidClient;
// Alpha Vantage API integration
class AlphaVantageClient {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.ALPHA_VANTAGE_API_KEY || 'demo_key';
        this.baseUrl = 'https://www.alphavantage.co/query';
    }
    async getDailyPrices(symbol) {
        // Use cached data if feature flag is enabled or in demo mode
        if (exports.featureFlags.USE_CACHED_APIS || exports.featureFlags.DEMO_MODE) {
            console.log(`Using cached Alpha Vantage data for ${symbol}`);
            return CACHED_ALPHA_VANTAGE_DATA;
        }
        // If Alpha Vantage is disabled, return cached data
        if (!exports.featureFlags.ENABLE_ALPHA_VANTAGE) {
            return CACHED_ALPHA_VANTAGE_DATA;
        }
        try {
            // In a real implementation, this would make actual API calls to Alpha Vantage
            // For demo purposes, we'll simulate the API call and return cached data
            console.log(`Simulating Alpha Vantage API call for ${symbol}...`);
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 150));
            return CACHED_ALPHA_VANTAGE_DATA;
        }
        catch (error) {
            console.error('Alpha Vantage API error:', error);
            // Fallback to cached data
            console.log(`Falling back to cached Alpha Vantage data for ${symbol} due to API error`);
            return CACHED_ALPHA_VANTAGE_DATA;
        }
    }
    async getMarketOverview() {
        if (exports.featureFlags.USE_CACHED_APIS || exports.featureFlags.DEMO_MODE) {
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
exports.AlphaVantageClient = AlphaVantageClient;
// Factory function to create API clients
function createAPIClients() {
    return {
        plaid: new PlaidClient(),
        alphaVantage: new AlphaVantageClient()
    };
}
// Utility function to check if APIs are available
function getAPIStatus() {
    return {
        plaid: {
            enabled: exports.featureFlags.ENABLE_PLAID,
            cached: exports.featureFlags.USE_CACHED_APIS,
            available: exports.featureFlags.ENABLE_PLAID || exports.featureFlags.USE_CACHED_APIS
        },
        alphaVantage: {
            enabled: exports.featureFlags.ENABLE_ALPHA_VANTAGE,
            cached: exports.featureFlags.USE_CACHED_APIS,
            available: exports.featureFlags.ENABLE_ALPHA_VANTAGE || exports.featureFlags.USE_CACHED_APIS
        },
        fred: {
            enabled: exports.featureFlags.ENABLE_FRED,
            cached: exports.featureFlags.USE_CACHED_APIS,
            available: false // Skipped as per requirements
        }
    };
}
// featureFlags already exported above
