/**
 * Minimal API Handler for CSV Upload and Insights
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { parseTransactionCSV } from './utils/csv-parser';
import { batchCreateTransactions, getTransactionsByDateRange } from './database/transactions';
import { getDailyInsightsForUser, getLatestDailyInsight } from './database/daily-insights';
import { getUserProfile, createUserProfile } from './database/user-profiles';
import { getLatestAutonomousRun } from './database/autonomous-runs';
import { UserProfile } from './types';
import { randomUUID } from 'crypto';

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
  console.log('Minimal API Handler - Event:', JSON.stringify(event, null, 2));

  try {
    const { httpMethod, path, pathParameters, queryStringParameters } = event;

    // Handle CORS preflight requests
    if (httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Route requests
    switch (true) {
      // Health check
      case httpMethod === 'GET' && path === '/health':
        return createResponse(200, {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'minimal-api'
        });

      // CSV Upload
      case httpMethod === 'POST' && path === '/transactions/upload':
        return await handleCSVUpload(event);

      // Get insights for a user
      case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/insights'):
        return await handleGetInsights(pathParameters?.userId, queryStringParameters as Record<string, string> | null);

      // Generate insights for a user
      case httpMethod === 'POST' && path.startsWith('/users/') && path.includes('/insights/generate'):
        return await handleGenerateInsights(pathParameters?.userId, event);

      // Invoke Bedrock Agent for analysis
      case httpMethod === 'POST' && path.startsWith('/agent/invoke'):
        return await handleAgentInvoke(event);

      // Get transactions for a user
      case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/transactions'):
        return await handleGetTransactions(pathParameters?.userId, queryStringParameters as Record<string, string> | null);

      // User management
      case httpMethod === 'POST' && path === '/users':
        return await handleCreateUser(event);

      case httpMethod === 'GET' && path.startsWith('/users/') && !path.includes('/transactions') && !path.includes('/insights'):
        return await handleGetUser(pathParameters?.userId);

      // Autonomous runs
      case httpMethod === 'GET' && path === '/autonomous-runs/latest':
        return await handleGetLatestAutonomousRun(queryStringParameters as Record<string, string> | null);

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

  // Validate user exists or create default profile
  let userProfile = await getUserProfile(userId);
  if (!userProfile) {
    // Create a default user profile
    const defaultProfile: UserProfile = {
      userId,
      financialGoals: [],
      riskTolerance: 'medium',
      preferredCategories: [],
      notificationPreferences: {
        weeklyInsights: true,
        feeAlerts: true,
        savingsGoals: true,
      },
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await createUserProfile(defaultProfile);
    userProfile = defaultProfile;
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
    const latestInsight = await getLatestDailyInsight(userId);
    return createResponse(200, {
      insight: latestInsight,
      isLatest: true
    });
  }

  const insights = await getDailyInsightsForUser(userId, limit);

  return createResponse(200, {
    insights,
    count: insights.length
  });
}

/**
 * Generate new insights (trigger daily insights generator)
 */
async function handleGenerateInsights(
  userId: string | undefined,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const body = JSON.parse(event.body || '{}');
  const { forceRegenerate = false } = body;

  try {
    // Import AWS SDK Lambda client
    const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
    
    const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
    
    // Invoke the daily insights generator Lambda for this specific user
    const payload = {
      userId: userId,
      forceRegenerate: forceRegenerate,
      source: 'api',
      timestamp: new Date().toISOString()
    };

    const command = new InvokeCommand({
      FunctionName: 'spending-insights-weekly-generator',
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify(payload)
    });

    await lambdaClient.send(command);

    return createResponse(202, {
      message: 'Daily insights generation started',
      userId,
      forceRegenerate,
      status: 'processing',
      estimatedCompletionTime: '30 seconds'
    });
  } catch (error) {
    console.error('Failed to trigger insights generation:', error);
    return createResponse(500, {
      error: 'Failed to trigger insights generation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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

  const startDate = queryParams?.startDate ? new Date(queryParams.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = queryParams?.endDate ? new Date(queryParams.endDate) : new Date();

  const transactions = await getTransactionsByDateRange(userId, startDate, endDate);

  return createResponse(200, {
    transactions,
    count: transactions.length,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    }
  });
}

/**
 * Create a new user
 */
async function handleCreateUser(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, email, name, financialGoals = [], riskTolerance = 'medium' } = body;

  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const userProfile: UserProfile = {
    userId,
    email,
    name,
    financialGoals,
    riskTolerance,
    preferredCategories: [],
    notificationPreferences: {
      weeklyInsights: true,
      feeAlerts: true,
      savingsGoals: true,
    },
    onboardingCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await createUserProfile(userProfile);

  return createResponse(201, {
    message: 'User created successfully',
    user: userProfile
  });
}

/**
 * Get user profile
 */
async function handleGetUser(userId?: string): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const userProfile = await getUserProfile(userId);

  if (!userProfile) {
    return createResponse(404, { error: 'User not found' });
  }

  return createResponse(200, { user: userProfile });
}

/**
 * Get latest autonomous run
 */
async function handleGetLatestAutonomousRun(
  queryParams?: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  const runType = queryParams?.runType || 'daily-insights';

  const latestRun = await getLatestAutonomousRun(runType);

  return createResponse(200, latestRun);
}

/**
 * Handle Bedrock Agent invocation
 */
async function handleAgentInvoke(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, message, sessionId } = body;

  if (!userId || !message) {
    return createResponse(400, { 
      error: 'Missing required fields',
      required: ['userId', 'message']
    });
  }

  try {
    // Import Bedrock Agent Runtime client
    const { BedrockAgentRuntimeClient, InvokeAgentCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
    
    const client = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
    
    // Use the agent ID from your infrastructure
    const agentId = 'ILBRXMGEWH'; // Your existing agent ID
    const agentAliasId = 'TSTALIASID'; // Default test alias
    
    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: sessionId || `session-${userId}-${Date.now()}`,
      inputText: message
    });

    const response = await client.send(command);
    
    // Process the streaming response
    let fullResponse = '';
    if (response.completion) {
      for await (const chunk of response.completion) {
        if (chunk.chunk?.bytes) {
          const text = new TextDecoder().decode(chunk.chunk.bytes);
          fullResponse += text;
        }
      }
    }

    return createResponse(200, {
      response: fullResponse,
      sessionId: command.input.sessionId,
      agentId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Agent invocation error:', error);
    return createResponse(500, {
      error: 'Failed to invoke agent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Create standardized API response
 */
function createResponse(statusCode: number, data: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data)
  };
}