"use strict";
/**
 * Minimal API Handler for CSV Upload and Insights
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const csv_parser_1 = require("./utils/csv-parser");
const transactions_1 = require("./database/transactions");
const daily_insights_1 = require("./database/daily-insights");
const user_profiles_1 = require("./database/user-profiles");
const autonomous_runs_1 = require("./database/autonomous-runs");
const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};
const handler = async (event, context) => {
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
                return await handleGetInsights(pathParameters?.userId, queryStringParameters);
            // Generate insights for a user
            case httpMethod === 'POST' && path.startsWith('/users/') && path.includes('/insights/generate'):
                return await handleGenerateInsights(pathParameters?.userId, event);
            // Get transactions for a user
            case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/transactions'):
                return await handleGetTransactions(pathParameters?.userId, queryStringParameters);
            // User management
            case httpMethod === 'POST' && path === '/users':
                return await handleCreateUser(event);
            case httpMethod === 'GET' && path.startsWith('/users/') && !path.includes('/transactions') && !path.includes('/insights'):
                return await handleGetUser(pathParameters?.userId);
            // Autonomous runs
            case httpMethod === 'GET' && path === '/autonomous-runs/latest':
                return await handleGetLatestAutonomousRun(queryStringParameters);
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
    // Validate user exists or create default profile
    let userProfile = await (0, user_profiles_1.getUserProfile)(userId);
    if (!userProfile) {
        // Create a default user profile
        const defaultProfile = {
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
        await (0, user_profiles_1.createUserProfile)(defaultProfile);
        userProfile = defaultProfile;
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
 * Generate new insights (trigger daily insights generator)
 */
async function handleGenerateInsights(userId, event) {
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
    }
    catch (error) {
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
async function handleGetTransactions(userId, queryParams) {
    if (!userId) {
        return createResponse(400, { error: 'User ID is required' });
    }
    const startDate = queryParams?.startDate ? new Date(queryParams.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = queryParams?.endDate ? new Date(queryParams.endDate) : new Date();
    const transactions = await (0, transactions_1.getTransactionsByDateRange)(userId, startDate, endDate);
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
async function handleCreateUser(event) {
    const body = JSON.parse(event.body || '{}');
    const { userId, email, name, financialGoals = [], riskTolerance = 'medium' } = body;
    if (!userId) {
        return createResponse(400, { error: 'User ID is required' });
    }
    const userProfile = {
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
    await (0, user_profiles_1.createUserProfile)(userProfile);
    return createResponse(201, {
        message: 'User created successfully',
        user: userProfile
    });
}
/**
 * Get user profile
 */
async function handleGetUser(userId) {
    if (!userId) {
        return createResponse(400, { error: 'User ID is required' });
    }
    const userProfile = await (0, user_profiles_1.getUserProfile)(userId);
    if (!userProfile) {
        return createResponse(404, { error: 'User not found' });
    }
    return createResponse(200, { user: userProfile });
}
/**
 * Get latest autonomous run
 */
async function handleGetLatestAutonomousRun(queryParams) {
    const runType = queryParams?.runType || 'daily-insights';
    const latestRun = await (0, autonomous_runs_1.getLatestAutonomousRun)(runType);
    return createResponse(200, latestRun);
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
