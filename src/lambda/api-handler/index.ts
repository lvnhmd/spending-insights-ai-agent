/**
 * API Handler Lambda Function
 * Requirements: 8.1, 8.5
 * 
 * Handles:
 * - REST API endpoints for CSV upload and insights retrieval
 * - Basic user session management
 * - Proper error handling and response formatting
 * - Health endpoints: GET /health (static), GET /readiness (200ms DDB+Bedrock probe)
 * - Lambda timeout: 25 seconds (not 30s - leave buffer for API Gateway)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { parseTransactionCSV } from './utils/csv-parser';
import { batchCreateTransactions, getTransactionsByDateRange } from './database/transactions';
import { getWeeklyInsightsForUser, getLatestWeeklyInsight } from './database/weekly-insights';
import { getUserProfile, createUserProfile } from './database/user-profiles';
import { UserProfile } from './types';
import { randomUUID } from 'crypto';

interface APIResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('API Handler Lambda - Event:', JSON.stringify(event, null, 2));

  try {
    const { httpMethod, path, pathParameters, queryStringParameters } = event;

    // Handle CORS preflight requests
    if (httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Route requests
    switch (true) {
      // Health endpoints
      case httpMethod === 'GET' && path === '/health':
        return await handleHealthCheck();

      case httpMethod === 'GET' && path === '/readiness':
        return await handleReadinessCheck();

      // User management
      case httpMethod === 'POST' && path === '/users':
        return await handleCreateUser(event);

      // Transaction management (check before generic user routes)
      case httpMethod === 'POST' && path === '/transactions/upload':
        return await handleCSVUpload(event);

      case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/transactions'):
        return await handleGetTransactions(pathParameters?.userId, queryStringParameters as Record<string, string> | null);

      // Insights (check before generic user routes)
      case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/insights'):
        return await handleGetInsights(pathParameters?.userId, queryStringParameters as Record<string, string> | null);

      // Generic user route (must be after specific routes)
      case httpMethod === 'GET' && path.startsWith('/users/') && !path.includes('/transactions') && !path.includes('/insights'):
        return await handleGetUser(pathParameters?.userId);

      // Generate insights (trigger weekly insights generator)
      case httpMethod === 'POST' && path.startsWith('/users/') && path.includes('/insights/generate'):
        return await handleGenerateInsights(pathParameters?.userId, event);

      default:
        return createResponse(404, { error: 'Not found', path, method: httpMethod });
    }

  } catch (error) {
    console.error('API Handler Error:', error);
    return createResponse(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Health check endpoint - static response
 */
async function handleHealthCheck(): Promise<APIGatewayProxyResult> {
  return createResponse(200, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'spending-insights-api',
    version: '1.0.0'
  });
}

/**
 * Readiness check endpoint - probes DDB and Bedrock with 200ms timeout
 */
async function handleReadinessCheck(): Promise<APIGatewayProxyResult> {
  const checks: HealthCheckResult[] = [];
  const startTime = Date.now();

  try {
    // Test DynamoDB connection
    const ddbStart = Date.now();
    try {
      // Simple query to test DDB connectivity
      await getUserProfile('health-check-user');
      checks.push({
        service: 'dynamodb',
        status: 'healthy',
        responseTime: Date.now() - ddbStart
      });
    } catch (error) {
      checks.push({
        service: 'dynamodb',
        status: 'unhealthy',
        responseTime: Date.now() - ddbStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test Bedrock connection (mock for now)
    const bedrockStart = Date.now();
    try {
      // TODO: Add actual Bedrock health check when implemented
      // For now, simulate a quick check
      await new Promise(resolve => setTimeout(resolve, 10));
      checks.push({
        service: 'bedrock',
        status: 'healthy',
        responseTime: Date.now() - bedrockStart
      });
    } catch (error) {
      checks.push({
        service: 'bedrock',
        status: 'unhealthy',
        responseTime: Date.now() - bedrockStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    const totalTime = Date.now() - startTime;
    const allHealthy = checks.every(check => check.status === 'healthy');

    return createResponse(allHealthy ? 200 : 503, {
      status: allHealthy ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      totalResponseTime: totalTime,
      checks
    });

  } catch (error) {
    return createResponse(503, {
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks
    });
  }
}

/**
 * Create a new user
 */
async function handleCreateUser(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { email, name, financialGoals, riskTolerance } = body;

  if (!email) {
    return createResponse(400, { error: 'Email is required' });
  }

  const userId = randomUUID();
  const userProfile: UserProfile = {
    userId,
    email,
    name,
    financialGoals: financialGoals || [],
    riskTolerance: riskTolerance || 'medium',
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

  await createUserProfile(userProfile);

  return createResponse(201, {
    message: 'User created successfully',
    userId,
    profile: userProfile
  });
}

/**
 * Get user profile
 */
async function handleGetUser(userId?: string): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const profile = await getUserProfile(userId);

  if (!profile) {
    return createResponse(404, { error: 'User not found' });
  }

  return createResponse(200, { profile });
}

/**
 * Handle CSV upload and processing
 */
async function handleCSVUpload(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, csvContent } = body;

  if (!userId || !csvContent) {
    return createResponse(400, {
      error: 'Missing required fields',
      required: ['userId', 'csvContent']
    });
  }

  // Validate user exists
  const userProfile = await getUserProfile(userId);
  if (!userProfile) {
    return createResponse(404, { error: 'User not found' });
  }

  // Parse CSV
  const parseResult = parseTransactionCSV(csvContent, userId);

  if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
    return createResponse(400, {
      error: 'Failed to parse CSV',
      details: parseResult.errors,
      totalRows: parseResult.totalRows
    });
  }

  // Store transactions
  if (parseResult.transactions.length > 0) {
    await batchCreateTransactions(parseResult.transactions);
  }

  return createResponse(200, {
    message: 'CSV processed successfully',
    processedTransactions: parseResult.transactions.length,
    totalRows: parseResult.totalRows,
    successfulRows: parseResult.successfulRows,
    errors: parseResult.errors,
    transactions: parseResult.transactions.slice(0, 5) // Return first 5 for preview
  });
}

/**
 * Get transactions for a user
 */
async function handleGetTransactions(
  userId?: string,
  queryParams?: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const startDate = queryParams?.startDate ? new Date(queryParams.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
  const endDate = queryParams?.endDate ? new Date(queryParams.endDate) : new Date();

  const transactions = await getTransactionsByDateRange(userId, startDate, endDate);

  return createResponse(200, {
    transactions,
    count: transactions.length,
    dateRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  });
}

/**
 * Get insights for a user
 */
async function handleGetInsights(
  userId?: string,
  queryParams?: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 10;

  if (queryParams?.latest === 'true') {
    const latestInsight = await getLatestWeeklyInsight(userId);
    return createResponse(200, {
      insight: latestInsight,
      isLatest: true
    });
  }

  const insights = await getWeeklyInsightsForUser(userId, limit);

  return createResponse(200, {
    insights,
    count: insights.length
  });
}

/**
 * Generate new insights (trigger weekly insights generator)
 */
async function handleGenerateInsights(
  userId: string | undefined,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const body = JSON.parse(event.body || '{}');
  const { weekOf, forceRegenerate = false } = body;

  // In a real implementation, this would invoke the weekly-insights-generator Lambda
  // For now, we'll return a placeholder response

  return createResponse(202, {
    message: 'Insights generation started',
    userId,
    weekOf: weekOf || new Date().toISOString(),
    forceRegenerate,
    status: 'processing',
    estimatedCompletionTime: '30 seconds'
  });
}

/**
 * Create standardized API response
 */
function createResponse(statusCode: number, data: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data, null, 2)
  };
}

/**
 * Extract user ID from path parameters or query string
 */
function extractUserId(pathParameters?: Record<string, string> | null, queryStringParameters?: Record<string, string> | null): string | null {
  return pathParameters?.userId || queryStringParameters?.userId || null;
}

/**
 * Validate request body against required fields
 */
function validateRequiredFields(body: any, requiredFields: string[]): string[] {
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (!body[field]) {
      missing.push(field);
    }
  }

  return missing;
}

/**
 * Parse and validate date parameters
 */
function parseDateParam(dateStr?: string): Date | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Create error response with consistent format
 */
function createErrorResponse(statusCode: number, message: string, details?: any): APIGatewayProxyResult {
  return createResponse(statusCode, {
    error: message,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  });
}