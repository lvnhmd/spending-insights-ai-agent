/**
 * Tests for DynamoDB operations with sample data
 * Requirements: 7.6, 8.1, 1.5
 */

// Mock uuid to avoid ES module issues in tests
const uuidv4 = () => `test-uuid-${Math.random().toString(36).substr(2, 9)}`;
import {
  createTransaction,
  getTransaction,
  getTransactionsByWeek,
  batchCreateTransactions,
  createWeeklyInsight,
  getWeeklyInsight,
  getLatestWeeklyInsight,
  setAgentMemory,
  getAgentMemory,
  setSessionMemory,
  getSessionMemory,
  createUserProfile,
  getUserProfile,
  getOrCreateUserProfile,
  MEMORY_SCOPES,
} from '../index';
import { Transaction, WeeklyInsight, UserProfile, ConversationTurn } from '../../types';

// Mock AWS SDK for testing
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn(),
    })),
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  QueryCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

describe('Database Operations', () => {
  const testUserId = 'test-user-123';
  const mockDocClient = {
    send: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the docClient
    require('../dynamodb-client').docClient = mockDocClient;
  });

  describe('Transaction Operations', () => {
    const sampleTransaction: Transaction = {
      id: uuidv4(),
      userId: testUserId,
      amount: -45.67,
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

    it('should create a transaction successfully', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      await expect(createTransaction(sampleTransaction)).resolves.not.toThrow();
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should get a transaction by ID', async () => {
      const mockRecord = {
        userId: `USER#${testUserId}`,
        transactionKey: `DT#2024-01-15#TX#${sampleTransaction.id}`,
        amount: sampleTransaction.amount,
        description: sampleTransaction.description,
        category: sampleTransaction.category,
        date: sampleTransaction.date.toISOString(),
        account: sampleTransaction.account,
        isRecurring: sampleTransaction.isRecurring,
        confidence: sampleTransaction.confidence,
        transactionType: sampleTransaction.transactionType,
      };

      mockDocClient.send.mockResolvedValueOnce({ Item: mockRecord });

      const result = await getTransaction(testUserId, sampleTransaction.id, sampleTransaction.date);
      
      expect(result).toBeTruthy();
      expect(result?.id).toBe(sampleTransaction.id);
      expect(result?.amount).toBe(sampleTransaction.amount);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent transaction', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const result = await getTransaction(testUserId, 'non-existent', new Date());
      
      expect(result).toBeNull();
    });

    it('should batch create multiple transactions', async () => {
      const transactions: Transaction[] = [
        { ...sampleTransaction, id: uuidv4(), description: 'Transaction 1' },
        { ...sampleTransaction, id: uuidv4(), description: 'Transaction 2' },
        { ...sampleTransaction, id: uuidv4(), description: 'Transaction 3' },
      ];

      mockDocClient.send.mockResolvedValue({});

      await expect(batchCreateTransactions(transactions)).resolves.not.toThrow();
      expect(mockDocClient.send).toHaveBeenCalledTimes(3); // One call per transaction
    });
  });

  describe('Weekly Insights Operations', () => {
    const sampleInsight: WeeklyInsight = {
      id: uuidv4(),
      userId: testUserId,
      weekOf: new Date('2024-01-15'),
      totalSpent: 234.56,
      topCategories: [
        {
          category: 'Food & Dining',
          totalAmount: 89.45,
          transactionCount: 5,
          averageAmount: 17.89,
          percentOfTotal: 38.1,
        },
      ],
      recommendations: [
        {
          id: uuidv4(),
          type: 'save',
          title: 'Reduce coffee spending',
          description: 'You spent $45 on coffee this week. Consider brewing at home.',
          potentialSavings: 30,
          difficulty: 'easy',
          priority: 8,
          actionSteps: ['Buy a coffee maker', 'Set up morning routine'],
          reasoning: 'High frequency coffee purchases detected',
          confidence: 0.85,
          estimatedTimeToImplement: '30 minutes',
          impact: 'medium',
        },
      ],
      potentialSavings: 30,
      implementedActions: [],
      generatedAt: new Date(),
      weekNumber: 3,
      year: 2024,
    };

    it('should create a weekly insight successfully', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      await expect(createWeeklyInsight(sampleInsight)).resolves.not.toThrow();
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should get a weekly insight', async () => {
      const mockRecord = {
        userId: `USER#${testUserId}`,
        weekKey: 'W#2024-W03',
        totalSpent: sampleInsight.totalSpent,
        topCategories: sampleInsight.topCategories,
        recommendations: sampleInsight.recommendations,
        potentialSavings: sampleInsight.potentialSavings,
        implementedActions: sampleInsight.implementedActions,
        generatedAt: sampleInsight.generatedAt.toISOString(),
        weekNumber: sampleInsight.weekNumber,
        year: sampleInsight.year,
      };

      mockDocClient.send.mockResolvedValueOnce({ Item: mockRecord });

      const result = await getWeeklyInsight(testUserId, sampleInsight.weekOf);
      
      expect(result).toBeTruthy();
      expect(result?.totalSpent).toBe(sampleInsight.totalSpent);
      expect(result?.weekNumber).toBe(sampleInsight.weekNumber);
    });
  });

  describe('Agent Memory Operations', () => {
    const sampleConversationTurn: ConversationTurn = {
      timestamp: new Date(),
      userInput: 'How much did I spend on coffee this week?',
      agentResponse: 'You spent $45 on coffee this week across 5 transactions.',
      context: { category: 'Food & Dining', amount: 45 },
    };

    it('should set and get session memory', async () => {
      mockDocClient.send.mockResolvedValueOnce({}); // for set
      mockDocClient.send.mockResolvedValueOnce({ // for get
        Item: {
          userId: `USER#${testUserId}`,
          memoryScope: 'SCOPE#session',
          sessionId: 'session-123',
          conversationHistory: [sampleConversationTurn],
        },
      });

      await setSessionMemory(testUserId, 'session-123', {
        conversationHistory: [sampleConversationTurn],
      });

      const result = await getSessionMemory(testUserId);
      
      expect(result).toBeTruthy();
      expect(result?.sessionId).toBe('session-123');
      expect(result?.conversationHistory).toHaveLength(1);
    });

    it('should handle memory scopes correctly', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      await setAgentMemory(testUserId, MEMORY_SCOPES.PREFERENCES, {
        learnedPreferences: [
          {
            key: 'preferred_coffee_shop',
            value: 'Starbucks',
            confidence: 0.8,
            learnedAt: new Date(),
            source: 'inferred',
          },
        ],
      });

      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Profile Operations', () => {
    const sampleProfile: UserProfile = {
      userId: testUserId,
      email: 'test@example.com',
      name: 'Test User',
      financialGoals: ['Save for emergency fund', 'Pay off credit card'],
      riskTolerance: 'medium',
      monthlyIncome: 5000,
      monthlyBudget: 4000,
      preferredCategories: ['Food & Dining', 'Transportation', 'Shopping'],
      notificationPreferences: {
        weeklyInsights: true,
        feeAlerts: true,
        savingsGoals: false,
      },
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a user profile successfully', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      await expect(createUserProfile(sampleProfile)).resolves.not.toThrow();
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should get a user profile', async () => {
      const mockRecord = {
        userId: `USER#${testUserId}`,
        profileType: 'PROFILE',
        email: sampleProfile.email,
        name: sampleProfile.name,
        financialGoals: sampleProfile.financialGoals,
        riskTolerance: sampleProfile.riskTolerance,
        monthlyIncome: sampleProfile.monthlyIncome,
        monthlyBudget: sampleProfile.monthlyBudget,
        preferredCategories: sampleProfile.preferredCategories,
        notificationPreferences: sampleProfile.notificationPreferences,
        onboardingCompleted: sampleProfile.onboardingCompleted,
        createdAt: sampleProfile.createdAt.toISOString(),
        updatedAt: sampleProfile.updatedAt.toISOString(),
      };

      mockDocClient.send.mockResolvedValueOnce({ Item: mockRecord });

      const result = await getUserProfile(testUserId);
      
      expect(result).toBeTruthy();
      expect(result?.email).toBe(sampleProfile.email);
      expect(result?.financialGoals).toEqual(sampleProfile.financialGoals);
    });

    it('should create default profile if none exists', async () => {
      mockDocClient.send.mockResolvedValueOnce({}); // get returns empty
      mockDocClient.send.mockResolvedValueOnce({}); // create succeeds

      const result = await getOrCreateUserProfile(testUserId);
      
      expect(result).toBeTruthy();
      expect(result.userId).toBe(testUserId);
      expect(result.onboardingCompleted).toBe(false);
      expect(mockDocClient.send).toHaveBeenCalledTimes(2); // get + create
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const error = new Error('ResourceNotFoundException');
      error.name = 'ResourceNotFoundException';
      mockDocClient.send.mockRejectedValueOnce(error);

      await expect(getUserProfile(testUserId)).rejects.toThrow('Table not found');
    });

    it('should handle validation errors', async () => {
      const error = new Error('ValidationException: Invalid parameter');
      error.name = 'ValidationException';
      mockDocClient.send.mockRejectedValueOnce(error);

      await expect(getUserProfile(testUserId)).rejects.toThrow('Invalid parameters');
    });
  });
});

// Integration test with sample data (requires actual DynamoDB tables)
describe('Integration Tests (requires deployed tables)', () => {
  // These tests would run against actual DynamoDB tables
  // Skip by default to avoid requiring AWS credentials during development
  
  it.skip('should perform end-to-end transaction flow', async () => {
    const userId = `integration-test-${Date.now()}`;
    const transactionId = uuidv4();
    
    // Create sample transaction
    const transaction: Transaction = {
      id: transactionId,
      userId,
      amount: -25.99,
      description: 'Test Transaction',
      category: 'Testing',
      date: new Date(),
      account: 'Test Account',
      isRecurring: false,
      confidence: 1.0,
      transactionType: 'debit',
    };

    // Test create
    await createTransaction(transaction);
    
    // Test retrieve
    const retrieved = await getTransaction(userId, transactionId, transaction.date);
    expect(retrieved).toBeTruthy();
    expect(retrieved?.amount).toBe(transaction.amount);
    
    // Test weekly query
    const weeklyTransactions = await getTransactionsByWeek(userId, transaction.date);
    expect(weeklyTransactions.length).toBeGreaterThan(0);
  });
});