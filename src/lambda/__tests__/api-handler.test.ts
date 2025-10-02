/**
 * Local tests for API Handler Lambda Function
 * Requirements: 8.1, 8.5
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../api-handler';

// Mock dependencies
jest.mock('../../utils/csv-parser');
jest.mock('../../database/transactions');
jest.mock('../../database/weekly-insights');
jest.mock('../../database/user-profiles');

const mockParseTransactionCSV = require('../../utils/csv-parser').parseTransactionCSV;
const mockBatchCreateTransactions = require('../../database/transactions').batchCreateTransactions;
const mockGetUserProfile = require('../../database/user-profiles').getUserProfile;
const mockCreateUserProfile = require('../../database/user-profiles').createUserProfile;

describe('API Handler Lambda', () => {
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
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Endpoints', () => {
    it('should return healthy status for /health endpoint', async () => {
      const event: APIGatewayProxyEvent = {
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
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('spending-insights-api');
    });

    it('should return readiness status for /readiness endpoint', async () => {
      // Mock successful health checks
      mockGetUserProfile.mockResolvedValueOnce(null);

      const event: APIGatewayProxyEvent = {
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
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('ready');
      expect(body.checks).toHaveLength(2); // DynamoDB and Bedrock
    });
  });

  describe('User Management', () => {
    it('should create a new user successfully', async () => {
      mockCreateUserProfile.mockResolvedValueOnce(undefined);

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        pathParameters: null,
        queryStringParameters: null,
        headers: {},
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
          financialGoals: ['Save money'],
          riskTolerance: 'medium'
        }),
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('User created successfully');
      expect(body.userId).toBeDefined();
      expect(mockCreateUserProfile).toHaveBeenCalledTimes(1);
    });

    it('should return error for missing email', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        pathParameters: null,
        queryStringParameters: null,
        headers: {},
        body: JSON.stringify({
          name: 'Test User'
        }),
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Email is required');
    });

    it('should get user profile', async () => {
      const mockProfile = {
        userId: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        financialGoals: ['Save money'],
        riskTolerance: 'medium',
        preferredCategories: [],
        notificationPreferences: {
          weeklyInsights: true,
          feeAlerts: true,
          savingsGoals: true
        },
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/users/test-user-123',
        pathParameters: { userId: 'test-user-123' },
        queryStringParameters: null,
        headers: {},
        body: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.userId).toBe('test-user-123');
      expect(body.profile.email).toBe('test@example.com');
    });
  });

  describe('CSV Upload', () => {
    it('should process CSV upload successfully', async () => {
      const mockProfile = { userId: 'test-user-123', email: 'test@example.com' };
      const mockParseResult = {
        transactions: [
          {
            id: 'tx-1',
            userId: 'test-user-123',
            amount: 25.99,
            description: 'Test Transaction',
            category: 'Shopping',
            date: new Date(),
            account: 'Checking',
            isRecurring: false,
            confidence: 0.8,
            transactionType: 'debit'
          }
        ],
        totalRows: 1,
        successfulRows: 1,
        errors: []
      };

      mockGetUserProfile.mockResolvedValueOnce(mockProfile);
      mockParseTransactionCSV.mockReturnValueOnce(mockParseResult);
      mockBatchCreateTransactions.mockResolvedValueOnce(undefined);

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/transactions/upload',
        pathParameters: null,
        queryStringParameters: null,
        headers: {},
        body: JSON.stringify({
          userId: 'test-user-123',
          csvContent: 'date,description,amount\n01/15/2024,Test Transaction,25.99'
        }),
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('CSV processed successfully');
      expect(body.processedTransactions).toBe(1);
      expect(mockBatchCreateTransactions).toHaveBeenCalledTimes(1);
    });

    it('should return error for missing userId', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/transactions/upload',
        pathParameters: null,
        queryStringParameters: null,
        headers: {},
        body: JSON.stringify({
          csvContent: 'date,description,amount\n01/15/2024,Test Transaction,25.99'
        }),
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Missing required fields');
    });

    it('should return error for non-existent user', async () => {
      mockGetUserProfile.mockResolvedValueOnce(null);

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/transactions/upload',
        pathParameters: null,
        queryStringParameters: null,
        headers: {},
        body: JSON.stringify({
          userId: 'non-existent-user',
          csvContent: 'date,description,amount\n01/15/2024,Test Transaction,25.99'
        }),
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('User not found');
    });
  });

  describe('CORS Handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'OPTIONS',
        path: '/any-path',
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
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers!['Access-Control-Allow-Methods']).toContain('GET,POST,PUT,DELETE,OPTIONS');
    });

    it('should include CORS headers in all responses', async () => {
      const event: APIGatewayProxyEvent = {
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
      };

      const result = await handler(event, mockContext);

      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers!['Content-Type']).toBe('application/json');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/unknown-route',
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
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Not found');
    });

    it('should handle internal errors gracefully', async () => {
      mockGetUserProfile.mockRejectedValueOnce(new Error('Database error'));

      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/users/test-user-123',
        pathParameters: { userId: 'test-user-123' },
        queryStringParameters: null,
        headers: {},
        body: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
      expect(body.message).toBe('Database error');
    });
  });
});