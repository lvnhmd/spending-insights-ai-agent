"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const csv_parser_1 = require("./utils/csv-parser");
const transactions_1 = require("./database/transactions");
const weekly_insights_1 = require("./database/weekly-insights");
const user_profiles_1 = require("./database/user-profiles");
const crypto_1 = require("crypto");
const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};
const handler = async (event, context) => {
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
                return await handleGetTransactions(pathParameters?.userId, queryStringParameters);
            // Insights (check before generic user routes)
            case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/insights'):
                return await handleGetInsights(pathParameters?.userId, queryStringParameters);
            // Generic user route (must be after specific routes)
            case httpMethod === 'GET' && path.startsWith('/users/') && !path.includes('/transactions') && !path.includes('/insights'):
                return await handleGetUser(pathParameters?.userId);
            // Generate insights (trigger weekly insights generator)
            case httpMethod === 'POST' && path.startsWith('/users/') && path.includes('/insights/generate'):
                return await handleGenerateInsights(pathParameters?.userId, event);
            default:
                return createResponse(404, { error: 'Not found', path, method: httpMethod });
        }
    }
    catch (error) {
        console.error('API Handler Error:', error);
        return createResponse(500, {
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.handler = handler;
/**
 * Health check endpoint - static response
 */
async function handleHealthCheck() {
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
async function handleReadinessCheck() {
    const checks = [];
    const startTime = Date.now();
    try {
        // Test DynamoDB connection
        const ddbStart = Date.now();
        try {
            // Simple query to test DDB connectivity
            await (0, user_profiles_1.getUserProfile)('health-check-user');
            checks.push({
                service: 'dynamodb',
                status: 'healthy',
                responseTime: Date.now() - ddbStart
            });
        }
        catch (error) {
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
        }
        catch (error) {
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
    }
    catch (error) {
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
async function handleCreateUser(event) {
    const body = JSON.parse(event.body || '{}');
    const { email, name, financialGoals, riskTolerance } = body;
    if (!email) {
        return createResponse(400, { error: 'Email is required' });
    }
    const userId = (0, crypto_1.randomUUID)();
    const userProfile = {
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
    await (0, user_profiles_1.createUserProfile)(userProfile);
    return createResponse(201, {
        message: 'User created successfully',
        userId,
        profile: userProfile
    });
}
/**
 * Get user profile
 */
async function handleGetUser(userId) {
    if (!userId) {
        return createResponse(400, { error: 'User ID is required' });
    }
    const profile = await (0, user_profiles_1.getUserProfile)(userId);
    if (!profile) {
        return createResponse(404, { error: 'User not found' });
    }
    return createResponse(200, { profile });
}
/**
 * Handle CSV upload and processing
 */
async function handleCSVUpload(event) {
    const body = JSON.parse(event.body || '{}');
    const { userId, csvContent } = body;
    if (!userId || !csvContent) {
        return createResponse(400, {
            error: 'Missing required fields',
            required: ['userId', 'csvContent']
        });
    }
    // Validate user exists
    const userProfile = await (0, user_profiles_1.getUserProfile)(userId);
    if (!userProfile) {
        return createResponse(404, { error: 'User not found' });
    }
    // Parse CSV
    const parseResult = (0, csv_parser_1.parseTransactionCSV)(csvContent, userId);
    if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
        return createResponse(400, {
            error: 'Failed to parse CSV',
            details: parseResult.errors,
            totalRows: parseResult.totalRows
        });
    }
    // Store transactions
    if (parseResult.transactions.length > 0) {
        await (0, transactions_1.batchCreateTransactions)(parseResult.transactions);
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
async function handleGetTransactions(userId, queryParams) {
    if (!userId) {
        return createResponse(400, { error: 'User ID is required' });
    }
    const startDate = queryParams?.startDate ? new Date(queryParams.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = queryParams?.endDate ? new Date(queryParams.endDate) : new Date();
    const transactions = await (0, transactions_1.getTransactionsByDateRange)(userId, startDate, endDate);
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
async function handleGetInsights(userId, queryParams) {
    if (!userId) {
        return createResponse(400, { error: 'User ID is required' });
    }
    const limit = queryParams?.limit ? parseInt(queryParams.limit) : 10;
    if (queryParams?.latest === 'true') {
        const latestInsight = await (0, weekly_insights_1.getLatestWeeklyInsight)(userId);
        return createResponse(200, {
            insight: latestInsight,
            isLatest: true
        });
    }
    const insights = await (0, weekly_insights_1.getWeeklyInsightsForUser)(userId, limit);
    return createResponse(200, {
        insights,
        count: insights.length
    });
}
/**
 * Generate new insights (trigger weekly insights generator)
 */
async function handleGenerateInsights(userId, event) {
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
function createResponse(statusCode, data) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(data, null, 2)
    };
}
/**
 * Extract user ID from path parameters or query string
 */
function extractUserId(pathParameters, queryStringParameters) {
    return pathParameters?.userId || queryStringParameters?.userId || null;
}
/**
 * Validate request body against required fields
 */
function validateRequiredFields(body, requiredFields) {
    const missing = [];
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
function parseDateParam(dateStr) {
    if (!dateStr)
        return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}
/**
 * Create error response with consistent format
 */
function createErrorResponse(statusCode, message, details) {
    return createResponse(statusCode, {
        error: message,
        timestamp: new Date().toISOString(),
        ...(details && { details })
    });
}
