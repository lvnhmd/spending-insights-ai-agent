/**
 * Local testing script for Lambda functions
 * Run with: npx ts-node src/lambda/test-local.ts
 */

import { handler as transactionProcessor } from './transaction-processor';
import { handler as weeklyInsightsGenerator } from './weekly-insights-generator';
import { handler as apiHandler } from './api-handler';

// Set mock mode
process.env.MODEL_MODE = 'mock';

async function testTransactionProcessor() {
  console.log('\n=== Testing Transaction Processor ===');
  
  const sampleCSV = `date,description,amount,account
2024-01-15,"WHOLE FOODS MARKET",-45.67,Checking
2024-01-16,"NETFLIX SUBSCRIPTION",-15.99,Credit Card
2024-01-17,"SHELL GAS STATION",-32.45,Checking
2024-01-18,"BANK FEE",-5.00,Checking`;

  const event = {
    userId: 'test-user-123',
    csvContent: sampleCSV,
    operation: 'process_csv' as const
  };

  try {
    const result = await transactionProcessor(event, {} as any);
    console.log('Transaction Processor Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Transaction Processor Error:', error);
  }
}

async function testWeeklyInsightsGenerator() {
  console.log('\n=== Testing Weekly Insights Generator ===');
  
  const event = {
    userId: 'test-user-123',
    weekOf: '2024-01-15',
    forceRegenerate: true
  };

  try {
    const result = await weeklyInsightsGenerator(event, {} as any);
    console.log('Weekly Insights Generator Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Weekly Insights Generator Error:', error);
  }
}

async function testApiHandler() {
  console.log('\n=== Testing API Handler ===');
  
  // Test health endpoint
  const healthEvent = {
    httpMethod: 'GET',
    path: '/health',
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: {} as any,
    resource: '',
    stageVariables: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null
  };

  try {
    const result = await apiHandler(healthEvent, {} as any);
    console.log('API Handler Health Check Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('API Handler Error:', error);
  }
}

async function runTests() {
  console.log('Starting Lambda function local tests...');
  console.log('Mock mode enabled - no AWS calls will be made');
  
  await testTransactionProcessor();
  await testWeeklyInsightsGenerator();
  await testApiHandler();
  
  console.log('\n=== All tests completed ===');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };