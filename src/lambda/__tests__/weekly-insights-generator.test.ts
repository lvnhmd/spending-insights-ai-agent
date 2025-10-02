/**
 * Local tests for Weekly Insights Generator Lambda Function
 * Requirements: 2.1, 2.2, 2.3, 2.4, 7.3, 8.6
 */

import { Context } from 'aws-lambda';
import { handler } from '../weekly-insights-generator';
import { Transaction, WeeklyInsight } from '../../types';

// Mock dependencies
jest.mock('../../database/transactions');
jest.mock('../../database/weekly-insights');

const mockGetTransactionsByWeek = require('../../database/transactions').getTransactionsByWeek;
const mockCreateWeeklyInsight = require('../../database/weekly-insights').createWeeklyInsight;
const mockGetWeeklyInsight = require('../../database/weekly-insights').getWeeklyInsight;

describe('Weekly Insights Generator Lambda', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'weekly-insights-generator',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:weekly-insights-generator',
    memoryLimitInMB: '512',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/weekly-insights-generator',
    logStreamName: 'test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  const sampleTransactions: Transaction[] = [
    {
      id: 'tx-1',
      userId: 'user-123',
      amount: 4.95,
      description: 'STARBUCKS COFFEE #1234',
      category: 'Food & Dining',
      subcategory: 'Coffee Shops',
      date: new Date('2024-01-15'),
      account: 'Chase Checking',
      isRecurring: false,
      confidence: 0.95,
      merchantName: 'Starbucks',
      transactionType: 'debit',
    },
    {
      id: 'tx-2',
      userId: 'user-123',
      amount: 15.99,
      description: 'NETFLIX SUBSCRIPTION',
      category: 'Entertainment',
      subcategory: 'Streaming',
      date: new Date('2024-01-15'),
      account: 'Chase Checking',
      isRecurring: true,
      confidence: 0.9,
      merchantName: 'Netflix',
      transactionType: 'debit',
    },
    {
      id: 'tx-3',
      userId: 'user-123',
      amount: 89.45,
      description: 'WHOLE FOODS MARKET',
      category: 'Groceries',
      subcategory: 'Supermarket',
      date: new Date('2024-01-16'),
      account: 'Chase Checking',
      isRecurring: false,
      confidence: 0.85,
      merchantName: 'Whole Foods',
      transactionType: 'debit',
    },
    {
      id: 'tx-4',
      userId: 'user-123',
      amount: 35.00,
      description: 'OVERDRAFT FEE',
      category: 'Fees',
      subcategory: 'Bank Fee',
      date: new Date('2024-01-17'),
      account: 'Chase Checking',
      isRecurring: false,
      confidence: 1.0,
      merchantName: 'Chase Bank',
      transactionType: 'debit',
    },
    {
      id: 'tx-5',
      userId: 'user-123',
      amount: 67.89,
      description: 'RESTAURANT DINNER',
      category: 'Food & Dining',
      subcategory: 'Restaurant',
      date: new Date('2024-01-18'),
      account: 'Chase Checking',
      isRecurring: false,
      confidence: 0.8,
      merchantName: 'Local Restaurant',
      transactionType: 'debit',
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Weekly Insights Generation', () => {
    it('should generate insights for a week with transactions', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null); // No existing insights
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15',
        forceRegenerate: false
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.generated).toBe(true);
      expect(result.insights).toBeDefined();
      expect(result.insights.recommendations).toBeDefined();
      expect(result.insights.recommendations.length).toBeGreaterThan(0);
      expect(mockCreateWeeklyInsight).toHaveBeenCalledTimes(1);
    });

    it('should return existing insights when not forcing regeneration', async () => {
      const existingInsight: WeeklyInsight = {
        id: 'insight-123',
        userId: 'user-123',
        weekOf: new Date('2024-01-15'),
        totalSpent: 213.28,
        topCategories: [],
        recommendations: [],
        potentialSavings: 0,
        implementedActions: [],
        generatedAt: new Date(),
        weekNumber: 3,
        year: 2024
      };

      mockGetWeeklyInsight.mockResolvedValueOnce(existingInsight);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15',
        forceRegenerate: false
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.generated).toBe(false);
      expect(result.insights).toEqual(existingInsight);
      expect(mockCreateWeeklyInsight).not.toHaveBeenCalled();
    });

    it('should handle week with no transactions', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce([]);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No transactions found for the specified week');
    });

    it('should force regeneration when requested', async () => {
      const existingInsight: WeeklyInsight = {
        id: 'insight-123',
        userId: 'user-123',
        weekOf: new Date('2024-01-15'),
        totalSpent: 213.28,
        topCategories: [],
        recommendations: [],
        potentialSavings: 0,
        implementedActions: [],
        generatedAt: new Date(),
        weekNumber: 3,
        year: 2024
      };

      mockGetWeeklyInsight.mockResolvedValueOnce(existingInsight);
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15',
        forceRegenerate: true
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.generated).toBe(true);
      expect(mockCreateWeeklyInsight).toHaveBeenCalledTimes(1);
    });
  });

  describe('Spending Pattern Analysis', () => {
    it('should analyze spending patterns correctly', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.insights.topCategories).toBeDefined();
      expect(result.insights.topCategories.length).toBeGreaterThan(0);

      // Check that categories are sorted by spending amount
      const categories = result.insights.topCategories;
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i-1].totalAmount).toBeGreaterThanOrEqual(categories[i].totalAmount);
      }
    });

    it('should calculate category spending percentages', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      const totalPercentage = result.insights.topCategories.reduce(
        (sum: number, cat: any) => sum + cat.percentOfTotal, 0
      );
      
      // Total percentage should be approximately 100% (allowing for rounding)
      expect(totalPercentage).toBeCloseTo(100, 1);
    });

    it('should identify high-spending categories', async () => {
      const highSpendingTransactions = [
        ...sampleTransactions,
        {
          id: 'tx-6',
          userId: 'user-123',
          amount: 250.00,
          description: 'EXPENSIVE RESTAURANT',
          category: 'Food & Dining',
          date: new Date('2024-01-19'),
          account: 'Chase Checking',
          isRecurring: false,
          confidence: 0.9,
          transactionType: 'debit',
        }
      ];

      mockGetTransactionsByWeek.mockResolvedValueOnce(highSpendingTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      // Should have recommendations for high spending categories
      const categoryOptimizationRecs = result.insights.recommendations.filter(
        (rec: any) => rec.type === 'optimize'
      );
      expect(categoryOptimizationRecs.length).toBeGreaterThan(0);
    });
  });

  describe('Savings Opportunity Detection', () => {
    it('should detect subscription savings opportunities', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      // Should detect Netflix subscription
      const subscriptionRecs = result.insights.recommendations.filter(
        (rec: any) => rec.type === 'eliminate_fee' && rec.title.includes('Netflix')
      );
      expect(subscriptionRecs.length).toBeGreaterThan(0);
      
      if (subscriptionRecs.length > 0) {
        expect(subscriptionRecs[0].potentialSavings).toBe(15.99 * 12); // Annualized
      }
    });

    it('should detect bank fee elimination opportunities', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      // Should detect overdraft fee
      const feeRecs = result.insights.recommendations.filter(
        (rec: any) => rec.type === 'eliminate_fee' && rec.title.includes('OVERDRAFT')
      );
      expect(feeRecs.length).toBeGreaterThan(0);
      
      if (feeRecs.length > 0) {
        expect(feeRecs[0].potentialSavings).toBe(35.00 * 12); // Annualized
      }
    });

    it('should detect duplicate transactions', async () => {
      const duplicateTransactions = [
        ...sampleTransactions,
        {
          id: 'tx-duplicate',
          userId: 'user-123',
          amount: 4.95, // Same amount as tx-1
          description: 'STARBUCKS COFFEE #1234', // Same description
          category: 'Food & Dining',
          date: new Date('2024-01-15'), // Same date
          account: 'Chase Checking',
          isRecurring: false,
          confidence: 0.95,
          transactionType: 'debit',
        }
      ];

      mockGetTransactionsByWeek.mockResolvedValueOnce(duplicateTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      // Should detect duplicate charges
      const duplicateRecs = result.insights.recommendations.filter(
        (rec: any) => rec.type === 'save' && rec.title.includes('duplicate')
      );
      expect(duplicateRecs.length).toBeGreaterThan(0);
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate actionable recommendations', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.insights.recommendations.length).toBeGreaterThan(0);

      // Check recommendation structure
      result.insights.recommendations.forEach((rec: any) => {
        expect(rec.id).toBeDefined();
        expect(rec.type).toBeDefined();
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.potentialSavings).toBeGreaterThan(0);
        expect(rec.difficulty).toMatch(/^(easy|medium|hard)$/);
        expect(rec.priority).toBeGreaterThan(0);
        expect(rec.actionSteps).toBeDefined();
        expect(Array.isArray(rec.actionSteps)).toBe(true);
        expect(rec.reasoning).toBeDefined();
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should prioritize recommendations by potential savings', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      const recommendations = result.insights.recommendations;
      
      // Check that recommendations are sorted by priority (higher priority first)
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i-1].priority).toBeGreaterThanOrEqual(recommendations[i].priority);
      }
    });

    it('should limit recommendations to avoid overwhelming users', async () => {
      // Create many transactions to potentially generate many recommendations
      const manyTransactions = [];
      for (let i = 0; i < 20; i++) {
        manyTransactions.push({
          ...sampleTransactions[0],
          id: `tx-${i}`,
          description: `SUBSCRIPTION SERVICE ${i}`,
          amount: 10 + i,
          isRecurring: true
        });
      }

      mockGetTransactionsByWeek.mockResolvedValueOnce(manyTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      // Should limit recommendations to a reasonable number
      expect(result.insights.recommendations.length).toBeLessThanOrEqual(6);
    });

    it('should provide detailed action steps', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      // Check that action steps are specific and actionable
      result.insights.recommendations.forEach((rec: any) => {
        expect(rec.actionSteps.length).toBeGreaterThan(0);
        rec.actionSteps.forEach((step: string) => {
          expect(step.length).toBeGreaterThan(10); // Should be descriptive
          expect(step).not.toMatch(/^(TODO|TBD|Fix|Update)$/i); // Should be specific
        });
      });
    });
  });

  describe('Calculation Accuracy', () => {
    it('should calculate total spent correctly', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      // Calculate expected total (only debit transactions)
      const expectedTotal = sampleTransactions
        .filter(t => t.transactionType === 'debit')
        .reduce((sum, t) => sum + t.amount, 0);
      
      expect(result.insights.totalSpent).toBe(expectedTotal);
    });

    it('should calculate potential savings correctly', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      
      // Potential savings should equal sum of all recommendation savings
      const expectedSavings = result.insights.recommendations.reduce(
        (sum: number, rec: any) => sum + rec.potentialSavings, 0
      );
      
      expect(result.insights.potentialSavings).toBe(expectedSavings);
    });

    it('should set correct week number and year', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15' // Week 3 of 2024
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.insights.weekNumber).toBe(3);
      expect(result.insights.year).toBe(2024);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing userId', async () => {
      const event = {
        weekOf: '2024-01-15'
        // Missing userId
      } as any;

      await expect(handler(event, mockContext)).rejects.toThrow('userId is required');
    });

    it('should handle database errors gracefully', async () => {
      mockGetTransactionsByWeek.mockRejectedValueOnce(new Error('Database connection failed'));

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
      };

      await expect(handler(event, mockContext)).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid date formats', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123',
        weekOf: 'invalid-date'
      };

      // Should handle invalid date by using current date
      const result = await handler(event, mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('Default Behavior', () => {
    it('should use current week when weekOf is not provided', async () => {
      mockGetTransactionsByWeek.mockResolvedValueOnce(sampleTransactions);
      mockGetWeeklyInsight.mockResolvedValueOnce(null);
      mockCreateWeeklyInsight.mockResolvedValueOnce(undefined);

      const event = {
        userId: 'user-123'
        // No weekOf provided
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.insights.weekOf).toBeDefined();
      expect(mockGetTransactionsByWeek).toHaveBeenCalledWith('user-123', expect.any(Date));
    });

    it('should default forceRegenerate to false', async () => {
      const existingInsight: WeeklyInsight = {
        id: 'insight-123',
        userId: 'user-123',
        weekOf: new Date('2024-01-15'),
        totalSpent: 213.28,
        topCategories: [],
        recommendations: [],
        potentialSavings: 0,
        implementedActions: [],
        generatedAt: new Date(),
        weekNumber: 3,
        year: 2024
      };

      mockGetWeeklyInsight.mockResolvedValueOnce(existingInsight);

      const event = {
        userId: 'user-123',
        weekOf: '2024-01-15'
        // No forceRegenerate provided
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.generated).toBe(false); // Should return existing
      expect(mockCreateWeeklyInsight).not.toHaveBeenCalled();
    });
  });
});