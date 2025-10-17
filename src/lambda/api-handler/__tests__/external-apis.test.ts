/**
 * External API Integration Tests for Lambda Environment
 * Requirements: 1.3, 7.4, 8.7
 */

import { createAPIClients, getAPIStatus, featureFlags } from '../utils/external-apis';

describe('External API Integration', () => {
  describe('Feature Flags', () => {
    test('should load feature flags with correct defaults', () => {
      expect(featureFlags.USE_CACHED_APIS).toBe(true);
      expect(featureFlags.MODEL_TIER).toBe('haiku');
      expect(featureFlags.ENABLE_PLAID).toBe(false);
      expect(featureFlags.ENABLE_ALPHA_VANTAGE).toBe(true);
      expect(featureFlags.DEMO_MODE).toBe(true);
    });
  });

  describe('API Status', () => {
    test('should return correct API availability status', () => {
      const status = getAPIStatus();
      
      expect(status.plaid.available).toBe(true);
      expect(status.alphaVantage.available).toBe(true);
      expect(status.fred.available).toBe(false);
      
      expect(status.plaid.cached).toBe(true);
      expect(status.alphaVantage.cached).toBe(true);
    });
  });

  describe('Plaid Client', () => {
    test('should return cached transaction data', async () => {
      const apiClients = createAPIClients();
      const result = await apiClients.plaid.getTransactions('test-user');
      
      expect(result).toHaveProperty('accounts');
      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('total_transactions');
      expect(result).toHaveProperty('request_id');
      
      expect(Array.isArray(result.accounts)).toBe(true);
      expect(Array.isArray(result.transactions)).toBe(true);
      expect(result.transactions.length).toBeGreaterThan(0);
      expect(result.accounts.length).toBeGreaterThan(0);
    });

    test('should return consistent data structure', async () => {
      const apiClients = createAPIClients();
      const result = await apiClients.plaid.getTransactions('test-user');
      
      // Validate account structure
      const account = result.accounts[0];
      expect(account).toHaveProperty('account_id');
      expect(account).toHaveProperty('balances');
      expect(account).toHaveProperty('name');
      expect(account).toHaveProperty('type');
      
      // Validate transaction structure
      const transaction = result.transactions[0];
      expect(transaction).toHaveProperty('transaction_id');
      expect(transaction).toHaveProperty('amount');
      expect(transaction).toHaveProperty('date');
      expect(transaction).toHaveProperty('merchant_name');
      expect(transaction).toHaveProperty('category');
    });
  });

  describe('Alpha Vantage Client', () => {
    test('should return cached stock data', async () => {
      const apiClients = createAPIClients();
      const result = await apiClients.alphaVantage.getDailyPrices('AAPL');
      
      expect(result).toHaveProperty('Meta Data');
      expect(result).toHaveProperty('Time Series (Daily)');
      
      expect(result['Meta Data']['2. Symbol']).toBe('AAPL');
      expect(Object.keys(result['Time Series (Daily)']).length).toBeGreaterThan(0);
    });

    test('should return market overview data', async () => {
      const apiClients = createAPIClients();
      const result = await apiClients.alphaVantage.getMarketOverview();
      
      expect(result).toHaveProperty('market_status');
      expect(result).toHaveProperty('last_updated');
      expect(result).toHaveProperty('major_indices');
      
      expect(typeof result.market_status).toBe('string');
      expect(typeof result.major_indices).toBe('object');
    });

    test('should validate stock data structure', async () => {
      const apiClients = createAPIClients();
      const result = await apiClients.alphaVantage.getDailyPrices('AAPL');
      
      const timeSeries = result['Time Series (Daily)'];
      const firstDate = Object.keys(timeSeries)[0];
      const dayData = timeSeries[firstDate];
      
      expect(dayData['1. open']).toBeDefined();
      expect(dayData['2. high']).toBeDefined();
      expect(dayData['3. low']).toBeDefined();
      expect(dayData['4. close']).toBeDefined();
      expect(dayData['5. volume']).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should return cached data quickly', async () => {
      const apiClients = createAPIClients();
      const startTime = Date.now();
      
      await Promise.all([
        apiClients.plaid.getTransactions('perf-test'),
        apiClients.alphaVantage.getDailyPrices('AAPL'),
        apiClients.alphaVantage.getMarketOverview()
      ]);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(100); // Should be very fast with cached data
    });
  });

  describe('Error Handling', () => {
    test('should handle missing user ID gracefully', async () => {
      const apiClients = createAPIClients();
      
      // Should still work with cached data even with invalid user ID
      const result = await apiClients.plaid.getTransactions('');
      expect(result).toHaveProperty('transactions');
    });

    test('should handle invalid stock symbol gracefully', async () => {
      const apiClients = createAPIClients();
      
      // Should return cached AAPL data regardless of symbol requested
      const result = await apiClients.alphaVantage.getDailyPrices('INVALID');
      expect(result).toHaveProperty('Meta Data');
    });
  });

  describe('Demo Reliability', () => {
    test('should work in demo mode', () => {
      expect(featureFlags.DEMO_MODE).toBe(true);
      expect(featureFlags.USE_CACHED_APIS).toBe(true);
    });

    test('should have consistent response structure for demos', async () => {
      const apiClients = createAPIClients();
      
      // Multiple calls should return identical data for demo consistency
      const call1 = await apiClients.plaid.getTransactions('demo-user');
      const call2 = await apiClients.plaid.getTransactions('demo-user');
      
      expect(call1.transactions.length).toBe(call2.transactions.length);
      expect(call1.accounts.length).toBe(call2.accounts.length);
    });
  });
});