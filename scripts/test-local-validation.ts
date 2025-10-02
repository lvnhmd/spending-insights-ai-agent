/**
 * Local validation script for Lambda functions
 * Requirements: 7.6, 8.1
 * 
 * Tests all Lambda functions with sample data locally
 * Validates categorization accuracy with diverse transaction types
 * Tests fee detection with various subscription patterns
 * Verifies recommendation generation produces actionable insights
 */

import { handler as transactionProcessor } from '../src/lambda/transaction-processor';
import { handler as weeklyInsightsGenerator } from '../src/lambda/weekly-insights-generator';
import { handler as apiHandler } from '../src/lambda/api-handler';
import { Transaction } from '../src/types';
import { Context } from 'aws-lambda';

// Mock context for Lambda functions
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
  memoryLimitInMB: '512',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Diverse transaction test data
const diverseTransactions: Transaction[] = [
  // Grocery transactions
  {
    id: 'tx-grocery-1',
    userId: 'test-user',
    amount: 89.45,
    description: 'WHOLE FOODS MARKET #123',
    category: 'Groceries',
    date: new Date('2024-01-15'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.85,
    merchantName: 'Whole Foods',
    transactionType: 'debit',
  },
  {
    id: 'tx-grocery-2',
    userId: 'test-user',
    amount: 67.23,
    description: 'SAFEWAY STORE #456',
    category: 'Groceries',
    date: new Date('2024-01-16'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.9,
    merchantName: 'Safeway',
    transactionType: 'debit',
  },
  
  // Coffee/Food transactions
  {
    id: 'tx-coffee-1',
    userId: 'test-user',
    amount: 4.95,
    description: 'STARBUCKS COFFEE #1234',
    category: 'Food & Dining',
    date: new Date('2024-01-15'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.95,
    merchantName: 'Starbucks',
    transactionType: 'debit',
  },
  {
    id: 'tx-coffee-2',
    userId: 'test-user',
    amount: 3.75,
    description: 'DUNKIN DONUTS #789',
    category: 'Food & Dining',
    date: new Date('2024-01-16'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.9,
    merchantName: 'Dunkin Donuts',
    transactionType: 'debit',
  },
  
  // Subscription services
  {
    id: 'tx-netflix',
    userId: 'test-user',
    amount: 15.99,
    description: 'NETFLIX.COM',
    category: 'Entertainment',
    date: new Date('2024-01-15'),
    account: 'Chase Checking',
    isRecurring: true,
    confidence: 0.95,
    merchantName: 'Netflix',
    transactionType: 'debit',
  },
  {
    id: 'tx-spotify',
    userId: 'test-user',
    amount: 9.99,
    description: 'SPOTIFY PREMIUM',
    category: 'Entertainment',
    date: new Date('2024-01-15'),
    account: 'Chase Checking',
    isRecurring: true,
    confidence: 0.95,
    merchantName: 'Spotify',
    transactionType: 'debit',
  },
  {
    id: 'tx-adobe',
    userId: 'test-user',
    amount: 52.99,
    description: 'ADOBE CREATIVE CLOUD',
    category: 'Software',
    date: new Date('2024-01-15'),
    account: 'Chase Checking',
    isRecurring: true,
    confidence: 0.9,
    merchantName: 'Adobe',
    transactionType: 'debit',
  },
  
  // Bank fees
  {
    id: 'tx-overdraft',
    userId: 'test-user',
    amount: 35.00,
    description: 'OVERDRAFT FEE',
    category: 'Fees',
    date: new Date('2024-01-17'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 1.0,
    merchantName: 'Chase Bank',
    transactionType: 'debit',
  },
  {
    id: 'tx-atm-fee',
    userId: 'test-user',
    amount: 3.50,
    description: 'ATM WITHDRAWAL FEE',
    category: 'Fees',
    date: new Date('2024-01-18'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 1.0,
    merchantName: 'ATM',
    transactionType: 'debit',
  },
  
  // Transportation
  {
    id: 'tx-gas-1',
    userId: 'test-user',
    amount: 45.67,
    description: 'SHELL GAS STATION #123',
    category: 'Transportation',
    date: new Date('2024-01-16'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.9,
    merchantName: 'Shell',
    transactionType: 'debit',
  },
  {
    id: 'tx-uber',
    userId: 'test-user',
    amount: 18.45,
    description: 'UBER TRIP',
    category: 'Transportation',
    date: new Date('2024-01-17'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.85,
    merchantName: 'Uber',
    transactionType: 'debit',
  },
  
  // Utilities
  {
    id: 'tx-electric',
    userId: 'test-user',
    amount: 125.50,
    description: 'ELECTRIC COMPANY BILL',
    category: 'Utilities',
    date: new Date('2024-01-15'),
    account: 'Chase Checking',
    isRecurring: true,
    confidence: 0.95,
    merchantName: 'Electric Company',
    transactionType: 'debit',
  },
  
  // Shopping
  {
    id: 'tx-amazon',
    userId: 'test-user',
    amount: 89.99,
    description: 'AMAZON.COM PURCHASE',
    category: 'Shopping',
    date: new Date('2024-01-16'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.8,
    merchantName: 'Amazon',
    transactionType: 'debit',
  },
  
  // Income
  {
    id: 'tx-salary',
    userId: 'test-user',
    amount: 2500.00,
    description: 'PAYCHECK DEPOSIT',
    category: 'Income',
    date: new Date('2024-01-15'),
    account: 'Chase Checking',
    isRecurring: true,
    confidence: 1.0,
    merchantName: 'Employer',
    transactionType: 'credit',
  }
];

interface ValidationResult {
  testName: string;
  passed: boolean;
  details: any;
  error?: string;
}

class LocalValidator {
  private results: ValidationResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Local Lambda Function Validation');
    console.log('================================================\n');

    // Set mock mode for testing
    process.env.MODEL_MODE = 'mock';

    try {
      await this.testTransactionCategorization();
      await this.testFeeDetection();
      await this.testSubscriptionPatterns();
      await this.testWeeklyInsightsGeneration();
      await this.testRecommendationQuality();
      await this.testAPIEndpoints();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Validation failed:', error);
    } finally {
      delete process.env.MODEL_MODE;
    }
  }

  private async testTransactionCategorization(): Promise<void> {
    console.log('📊 Testing Transaction Categorization...');
    
    try {
      const result = await transactionProcessor({
        userId: 'test-user',
        transactions: diverseTransactions,
        operation: 'categorize'
      }, mockContext);

      const passed = result.success && result.results.length === diverseTransactions.length;
      
      // Validate categorization accuracy
      const accuracyTests = [
        { transaction: 'WHOLE FOODS MARKET', expectedCategory: 'Groceries' },
        { transaction: 'STARBUCKS COFFEE', expectedCategory: 'Food & Dining' },
        { transaction: 'NETFLIX.COM', expectedCategory: 'Entertainment' },
        { transaction: 'SHELL GAS STATION', expectedCategory: 'Transportation' },
        { transaction: 'OVERDRAFT FEE', expectedCategory: 'Fees' }
      ];

      let accurateCategories = 0;
      for (const test of accuracyTests) {
        const categorization = result.results.find((r: any) => 
          diverseTransactions.find(t => t.id === r.transactionId)?.description.includes(test.transaction.split(' ')[0])
        );
        if (categorization && categorization.category === test.expectedCategory) {
          accurateCategories++;
        }
      }

      const accuracy = (accurateCategories / accuracyTests.length) * 100;

      this.results.push({
        testName: 'Transaction Categorization',
        passed: passed && accuracy >= 80, // Require 80% accuracy
        details: {
          totalTransactions: diverseTransactions.length,
          categorized: result.results.length,
          accuracy: `${accuracy}%`,
          averageConfidence: result.results.reduce((sum: number, r: any) => sum + r.confidence, 0) / result.results.length
        }
      });

      console.log(`   ✅ Categorized ${result.results.length}/${diverseTransactions.length} transactions`);
      console.log(`   📈 Accuracy: ${accuracy}%`);
      
    } catch (error) {
      this.results.push({
        testName: 'Transaction Categorization',
        passed: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testFeeDetection(): Promise<void> {
    console.log('💰 Testing Fee Detection...');
    
    try {
      const result = await transactionProcessor({
        userId: 'test-user',
        transactions: diverseTransactions,
        operation: 'detect_fees'
      }, mockContext);

      const subscriptionFees = result.results.filter((r: any) => r.isSubscription);
      const bankFees = result.results.filter((r: any) => r.isFee);
      
      // Expected: Netflix, Spotify, Adobe subscriptions + overdraft, ATM fees
      const expectedSubscriptions = 3;
      const expectedFees = 2;

      const passed = result.success && 
                    subscriptionFees.length >= expectedSubscriptions - 1 && // Allow some tolerance
                    bankFees.length >= expectedFees - 1;

      this.results.push({
        testName: 'Fee Detection',
        passed,
        details: {
          totalAnalyzed: diverseTransactions.length,
          subscriptionsDetected: subscriptionFees.length,
          feesDetected: bankFees.length,
          totalAnnualCost: result.results.reduce((sum: number, r: any) => sum + r.annualCost, 0)
        }
      });

      console.log(`   🔍 Detected ${subscriptionFees.length} subscriptions, ${bankFees.length} fees`);
      
    } catch (error) {
      this.results.push({
        testName: 'Fee Detection',
        passed: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testSubscriptionPatterns(): Promise<void> {
    console.log('🔄 Testing Subscription Pattern Recognition...');
    
    const subscriptionTransactions = diverseTransactions.filter(t => t.isRecurring);
    
    try {
      const result = await transactionProcessor({
        userId: 'test-user',
        transactions: subscriptionTransactions,
        operation: 'detect_fees'
      }, mockContext);

      const detectedSubscriptions = result.results.filter((r: any) => r.isSubscription);
      const totalAnnualCost = detectedSubscriptions.reduce((sum: number, r: any) => sum + r.annualCost, 0);

      const passed = result.success && detectedSubscriptions.length >= 2; // At least Netflix and Spotify

      this.results.push({
        testName: 'Subscription Pattern Recognition',
        passed,
        details: {
          recurringTransactions: subscriptionTransactions.length,
          subscriptionsDetected: detectedSubscriptions.length,
          totalAnnualCost: totalAnnualCost,
          patterns: detectedSubscriptions.map((s: any) => ({
            transactionId: s.transactionId,
            frequency: s.recurringPattern?.frequency,
            annualCost: s.annualCost
          }))
        }
      });

      console.log(`   📅 Analyzed ${subscriptionTransactions.length} recurring transactions`);
      console.log(`   💸 Total annual subscription cost: $${totalAnnualCost.toFixed(2)}`);
      
    } catch (error) {
      this.results.push({
        testName: 'Subscription Pattern Recognition',
        passed: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testWeeklyInsightsGeneration(): Promise<void> {
    console.log('📈 Testing Weekly Insights Generation...');
    
    // For this test, we'll use the actual functions with mock data
    // The weekly insights generator will work with the provided sample data

    try {
      const result = await weeklyInsightsGenerator({
        userId: 'test-user',
        weekOf: '2024-01-15'
      }, mockContext);

      const passed = result.success && 
                    result.insights && 
                    result.insights.recommendations.length > 0 &&
                    result.insights.potentialSavings > 0;

      this.results.push({
        testName: 'Weekly Insights Generation',
        passed,
        details: {
          recommendationsGenerated: result.insights?.recommendations.length || 0,
          potentialSavings: result.insights?.potentialSavings || 0,
          topCategories: result.insights?.topCategories.length || 0,
          totalSpent: result.insights?.totalSpent || 0
        }
      });

      console.log(`   💡 Generated ${result.insights?.recommendations.length || 0} recommendations`);
      console.log(`   💰 Potential savings: $${result.insights?.potentialSavings.toFixed(2) || 0}`);
      
    } catch (error) {
      this.results.push({
        testName: 'Weekly Insights Generation',
        passed: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testRecommendationQuality(): Promise<void> {
    console.log('⭐ Testing Recommendation Quality...');
    
    try {
      const result = await weeklyInsightsGenerator({
        userId: 'test-user',
        weekOf: '2024-01-15'
      }, mockContext);

      if (!result.success || !result.insights) {
        throw new Error('Failed to generate insights for recommendation quality test');
      }

      const recommendations = result.insights.recommendations;
      
      // Quality checks
      const hasActionSteps = recommendations.every((rec: any) => 
        rec.actionSteps && rec.actionSteps.length > 0
      );
      
      const hasReasoningExplanation = recommendations.every((rec: any) => 
        rec.reasoning && rec.reasoning.length > 10
      );
      
      const hasPotentialSavings = recommendations.every((rec: any) => 
        rec.potentialSavings > 0
      );
      
      const hasConfidenceScores = recommendations.every((rec: any) => 
        rec.confidence >= 0 && rec.confidence <= 1
      );

      const qualityScore = [hasActionSteps, hasReasoningExplanation, hasPotentialSavings, hasConfidenceScores]
        .filter(Boolean).length / 4 * 100;

      const passed = qualityScore >= 75; // Require 75% quality score

      this.results.push({
        testName: 'Recommendation Quality',
        passed,
        details: {
          totalRecommendations: recommendations.length,
          qualityScore: `${qualityScore}%`,
          hasActionSteps,
          hasReasoningExplanation,
          hasPotentialSavings,
          hasConfidenceScores,
          avgConfidence: recommendations.reduce((sum: number, r: any) => sum + r.confidence, 0) / recommendations.length
        }
      });

      console.log(`   🎯 Quality score: ${qualityScore}%`);
      
    } catch (error) {
      this.results.push({
        testName: 'Recommendation Quality',
        passed: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testAPIEndpoints(): Promise<void> {
    console.log('🌐 Testing API Endpoints...');
    
    try {
      // Test health endpoint
      const healthResult = await apiHandler({
        httpMethod: 'GET',
        path: '/health',
        pathParameters: null,
        queryStringParameters: null,
        headers: {},
        body: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      }, mockContext);

      // Test readiness endpoint
      const readinessResult = await apiHandler({
        httpMethod: 'GET',
        path: '/readiness',
        pathParameters: null,
        queryStringParameters: null,
        headers: {},
        body: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      }, mockContext);

      const passed = healthResult.statusCode === 200 && readinessResult.statusCode === 200;

      this.results.push({
        testName: 'API Endpoints',
        passed,
        details: {
          healthStatus: healthResult.statusCode,
          readinessStatus: readinessResult.statusCode,
          healthResponse: JSON.parse(healthResult.body),
          readinessResponse: JSON.parse(readinessResult.body)
        }
      });

      console.log(`   🏥 Health endpoint: ${healthResult.statusCode}`);
      console.log(`   ⚡ Readiness endpoint: ${readinessResult.statusCode}`);
      
    } catch (error) {
      this.results.push({
        testName: 'API Endpoints',
        passed: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private printResults(): void {
    console.log('\n📋 Validation Results');
    console.log('=====================\n');

    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;

    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.testName}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      } else {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${key}: ${JSON.stringify(value)}`);
        });
      }
      console.log('');
    });

    console.log(`🎯 Overall Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Lambda functions are ready for deployment.');
    } else {
      console.log('⚠️  Some tests failed. Review the results above.');
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new LocalValidator();
  validator.runAllTests().catch(console.error);
}

export { LocalValidator, diverseTransactions };