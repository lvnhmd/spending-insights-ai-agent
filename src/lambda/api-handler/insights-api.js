"use strict";
/**
 * Minimal API Handler for Daily Insights
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const daily_insights_1 = require("./database/daily-insights");
const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};
const handler = async (event, context) => {
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
                return await handleGetInsights(pathParameters?.userId, queryStringParameters);
            default:
                return createResponse(404, { error: 'Not found', path, method: httpMethod });
        }
    }
    catch (error) {
        console.error('Insights API Handler Error:', error);
        return createResponse(500, {
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.handler = handler;
/**
 * Get insights for a user
 */
async function handleGetInsights(userId, queryParams) {
    if (!userId) {
        return createResponse(400, { error: 'User ID is required' });
    }
    const limit = queryParams?.limit ? parseInt(queryParams.limit) : 10;
    if (queryParams?.latest === 'true') {
        const latestInsight = await (0, daily_insights_1.getLatestDailyInsight)(userId);
        return createResponse(200, {
            insight: latestInsight,
            isLatest: true
        });
    }
    const insights = await (0, daily_insights_1.getDailyInsightsForUser)(userId, limit);
    return createResponse(200, {
        insights,
        count: insights.length
    });
}
/**
 * Create standardized API response
 */
function createResponse(statusCode, data) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(data)
    };
}
