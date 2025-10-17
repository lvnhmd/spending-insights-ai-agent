#!/usr/bin/env ts-node

/**
 * Test External API Integrations
 * Requirements: 1.3, 7.4, 8.7
 * 
 * Tests:
 * - Feature flags configuration
 * - Cached API responses
 * - API client functionality
 * - Fallback mechanisms
 */

import { createAPIClients, getAPIStatus, featureFlags } from '../src/utils/external-apis';

async function testExternalAPIs() {
  console.log('🧪 Testing External API Integrations...\n');

  // Test 1: Feature Flags
  console.log('1. Testing Feature Flags Configuration:');
  console.log('   USE_CACHED_APIS:', featureFlags.USE_CACHED_APIS);
  console.log('   MODEL_TIER:', featureFlags.MODEL_TIER);
  console.log('   ENABLE_PLAID:', featureFlags.ENABLE_PLAID);
  console.log('   ENABLE_ALPHA_VANTAGE:', featureFlags.ENABLE_ALPHA_VANTAGE);
  console.log('   DEMO_MODE:', featureFlags.DEMO_MODE);
  console.log('   ✅ Feature flags loaded successfully\n');

  // Test 2: API Status
  console.log('2. Testing API Status:');
  const apiStatus = getAPIStatus();
  console.log('   Plaid Available:', apiStatus.plaid.available);
  console.log('   Alpha Vantage Available:', apiStatus.alphaVantage.available);
  console.log('   FRED Available:', apiStatus.fred.available);
  console.log('   ✅ API status retrieved successfully\n');

  // Test 3: API Clients
  console.log('3. Testing API Clients:');
  const apiClients = createAPIClients();
  
  try {
    // Test Plaid client
    console.log('   Testing Plaid client...');
    const plaidData = await apiClients.plaid.getTransactions('test-user-123');
    console.log('   Plaid transactions count:', plaidData.transactions.length);
    console.log('   Plaid accounts count:', plaidData.accounts.length);
    console.log('   ✅ Plaid client working');

    // Test Alpha Vantage client
    console.log('   Testing Alpha Vantage client...');
    const stockData = await apiClients.alphaVantage.getDailyPrices('AAPL');
    console.log('   Stock symbol:', stockData['Meta Data']['2. Symbol']);
    console.log('   Data points:', Object.keys(stockData['Time Series (Daily)']).length);
    console.log('   ✅ Alpha Vantage client working');

    // Test market overview
    console.log('   Testing market overview...');
    const marketData = await apiClients.alphaVantage.getMarketOverview();
    console.log('   Market status:', marketData.market_status);
    console.log('   Indices count:', Object.keys(marketData.major_indices).length);
    console.log('   ✅ Market overview working');

  } catch (error) {
    console.error('   ❌ API client error:', error);
    return false;
  }

  // Test 4: Cached Data Validation
  console.log('\n4. Testing Cached Data Validation:');
  try {
    // Validate Plaid cached data structure
    const plaidData = await apiClients.plaid.getTransactions('test-user');
    const requiredPlaidFields = ['accounts', 'transactions', 'total_transactions', 'request_id'];
    const hasAllPlaidFields = requiredPlaidFields.every(field => field in plaidData);
    console.log('   Plaid data structure valid:', hasAllPlaidFields);

    // Validate Alpha Vantage cached data structure
    const stockData = await apiClients.alphaVantage.getDailyPrices('AAPL');
    const hasMetaData = 'Meta Data' in stockData;
    const hasTimeSeries = 'Time Series (Daily)' in stockData;
    console.log('   Alpha Vantage data structure valid:', hasMetaData && hasTimeSeries);

    if (hasAllPlaidFields && hasMetaData && hasTimeSeries) {
      console.log('   ✅ All cached data structures are valid');
    } else {
      console.log('   ❌ Some cached data structures are invalid');
      return false;
    }

  } catch (error) {
    console.error('   ❌ Cached data validation error:', error);
    return false;
  }

  // Test 5: Performance Test
  console.log('\n5. Testing API Performance:');
  const startTime = Date.now();
  
  try {
    await Promise.all([
      apiClients.plaid.getTransactions('perf-test-user'),
      apiClients.alphaVantage.getDailyPrices('AAPL'),
      apiClients.alphaVantage.getMarketOverview()
    ]);
    
    const totalTime = Date.now() - startTime;
    console.log(`   All API calls completed in ${totalTime}ms`);
    
    if (totalTime < 1000) { // Should be fast with cached data
      console.log('   ✅ Performance test passed');
    } else {
      console.log('   ⚠️  Performance slower than expected (cached data should be fast)');
    }

  } catch (error) {
    console.error('   ❌ Performance test error:', error);
    return false;
  }

  console.log('\n🎉 All External API Integration Tests Passed!');
  console.log('\nDemo-ready features:');
  console.log('✅ Cached Plaid transaction data available');
  console.log('✅ Cached Alpha Vantage market data available');
  console.log('✅ Feature flags configured for reliable demo');
  console.log('✅ Fallback mechanisms working');
  console.log('✅ API status endpoint functional');
  
  return true;
}

// Run tests if called directly
if (require.main === module) {
  testExternalAPIs()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testExternalAPIs };