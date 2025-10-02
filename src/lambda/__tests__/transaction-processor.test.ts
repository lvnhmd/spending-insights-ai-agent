/**
 * Local tests for Transaction Processor Lambda Function
 * Requirements: 1.2, 1.4, 3.1, 3.2, 7.3
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../transaction-processor';
import { Transaction } from '../../types';

interface TransactionProcessorEvent {
  userId: string;
  csvContent?: string;
  transactions?: Transaction[];
  operation: 'categorize' | 'detect_fees' | 'process_csv';
}

// Mock dependencies
jest.mock('../../utils/csv-parser');
jest.mock('../../database/transactions');

const mockParseTransactionCSV = require('../../utils/csv-parser').parseTransactionCSV;
const mockBatchCreateTransactions = require('../../database/transactions').batchCreateTransactions;

describe('Transaction Processor Lambda', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'transaction-processor',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:transaction-processor',
    memoryLimitInMB: '512',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/transaction-processor',
    logStreamName: 'test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  const sampleTransaction: Transaction = {
    id: 'tx-123',
    userId: 'user-123',
    amount: 25.99,
    description: 'STARBUCKS COFFEE #1234',
    category: 'Food & Dining',
    subcategory: 'Coffee Shops',
    date: new Date('2024-01-15'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.95,
    originalDescription: 'STARBUCKS COFFEE #1234 SEATTLE WA',
    merchantName: 'Starbucks',
    transactionType: 'debit',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Set mock mode for testing
    process.env.MODEL_MODE = 'mock';
  });

  afterEach(() => {
    delete process.env.MODEL_MODE;
  });

  describe('CSV Processing', () => {
    it('should process CSV content successfully', async () => {
      const mockParseResult = {
        transactions: [sampleTransaction],
        totalRows: 1,
        successfulRows: 1,
        errors: []
      };

      mockParseTransactionCSV.mockReturnValueOnce(mockParseResult);
      mockBatchCreateTransactions.mockResolvedValueOnce(undefined);

      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        csvContent: 'date,description,amount\n01/15/2024,STARBUCKS COFFEE #1234,25.99',
        operation: 'process_csv'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(result.categorizedTransactions).toBe(1);
      expect(mockBatchCreateTransactions).toHaveBeenCalledTimes(1);
    });

    it('should handle CSV parsing errors', async () => {
      const mockParseResult = {
        transactions: [],
        totalRows: 1,
        successfulRows: 0,
        errors: [{ row: 1, error: 'Invalid date format' }]
      };

      mockParseTransactionCSV.mockReturnValueOnce(mockParseResult);

      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        csvContent: 'date,description,amount\ninvalid-date,Transaction,25.99',
        operation: 'process_csv'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No valid transactions found in CSV');
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Transaction Categorization', () => {
    it('should categorize transactions using mock data', async () => {
      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        transactions: [sampleTransaction],
        operation: 'categorize'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].category).toBeDefined();
      expect(result.results[0].confidence).toBeGreaterThan(0);
    });

    it('should categorize grocery transactions correctly', async () => {
      const groceryTransaction = {
        ...sampleTransaction,
        description: 'WHOLE FOODS MARKET #123',
        merchantName: 'Whole Foods'
      };

      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        transactions: [groceryTransaction],
        operation: 'categorize'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.results[0].category).toBe('Groceries');
      expect(result.results[0].subcategory).toBe('Supermarket');
    });
  });

  describe('Fee Detection', () => {
    it('should detect subscription fees', async () => {
      const subscriptionTransaction = {
        ...sampleTransaction,
        description: 'NETFLIX MONTHLY SUBSCRIPTION',
        amount: 15.99
      };

      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        transactions: [subscriptionTransaction],
        operation: 'detect_fees'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.feesDetected).toBe(1);
      expect(result.results[0].isSubscription).toBe(true);
      expect(result.results[0].annualCost).toBe(15.99 * 12);
    });

    it('should detect bank fees', async () => {
      const feeTransaction = {
        ...sampleTransaction,
        description: 'OVERDRAFT FEE',
        amount: 35.00
      };

      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        transactions: [feeTransaction],
        operation: 'detect_fees'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.feesDetected).toBe(1);
      expect(result.results[0].isFee).toBe(true);
      expect(result.results[0].annualCost).toBe(35.00 * 12);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing CSV content', async () => {
      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        operation: 'process_csv'
        // Missing csvContent
      };

      await expect(handler(event, mockContext)).rejects.toThrow('CSV content is required');
    });

    it('should handle missing transactions array', async () => {
      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        operation: 'categorize'
        // Missing transactions
      };

      await expect(handler(event, mockContext)).rejects.toThrow('Transactions array is required');
    });

    it('should handle unknown operation', async () => {
      const event = {
        userId: 'user-123',
        operation: 'unknown_operation'
      } as any;

      await expect(handler(event, mockContext)).rejects.toThrow('Unknown operation: unknown_operation');
    });
  });

  describe('Mock Mode Behavior', () => {
    it('should use mock categorization when MODEL_MODE=mock', async () => {
      process.env.MODEL_MODE = 'mock';

      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        transactions: [sampleTransaction],
        operation: 'categorize'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.results[0].reasoning).toContain('Mock categorization');
    });

    it('should use mock fee detection when MODEL_MODE=mock', async () => {
      process.env.MODEL_MODE = 'mock';

      const event: TransactionProcessorEvent = {
        userId: 'user-123',
        transactions: [sampleTransaction],
        operation: 'detect_fees'
      };

      const result = await handler(event, mockContext);

      expect(result.success).toBe(true);
      if (result.feesDetected > 0) {
        expect(result.results[0].reasoning).toContain('Mock fee detection');
      }
    });
  });
});