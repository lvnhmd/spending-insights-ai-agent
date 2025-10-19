/**
 * Minimal API Handler for Daily Insights
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { getDailyInsightsForUser, getLatestDailyInsight } from './database/daily-insights';

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
  console.log('Insights API Handler - Event:', JSON.stringify(event, null, 2));

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
          service: 'insights-api'
        });

      // Get insights for a user
      case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/insights'):
        return await handleGetInsights(pathParameters?.userId, queryStringParameters as Record<string, string> | null);

      default:
        return createResponse(404, { error: 'Not found', path, method: httpMethod });
    }

  } catch (error) {
    console.error('Insights API Handler Error:', error);
    return createResponse(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

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
 * Create standardized API response
 */
function createResponse(statusCode: number, data: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data)
  };
}