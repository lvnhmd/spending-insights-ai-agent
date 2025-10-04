"use strict";
/**
 * DynamoDB client setup with error handling
 * Requirements: 7.6, 8.1, 1.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABLE_NAMES = exports.docClient = void 0;
exports.withErrorHandling = withErrorHandling;
exports.generateTransactionKey = generateTransactionKey;
exports.generateUserWeekKey = generateUserWeekKey;
exports.generateWeekKey = generateWeekKey;
exports.generateUserKey = generateUserKey;
exports.generateScopeKey = generateScopeKey;
exports.generateTTL = generateTTL;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
// DynamoDB client configuration
const client = new client_dynamodb_1.DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    maxAttempts: 3,
});
// Document client for easier operations
exports.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
    },
    unmarshallOptions: {
        wrapNumbers: false,
    },
});
// Table names from environment or defaults
exports.TABLE_NAMES = {
    TRANSACTIONS: process.env.TRANSACTIONS_TABLE || 'spending-insights-transactions',
    WEEKLY_INSIGHTS: process.env.WEEKLY_INSIGHTS_TABLE || 'spending-insights-weekly-insights',
    AGENT_MEMORY: process.env.AGENT_MEMORY_TABLE || 'spending-insights-agent-memory',
    USER_PROFILES: process.env.USER_PROFILES_TABLE || 'spending-insights-user-profiles',
};
// Error handling wrapper for DynamoDB operations
async function withErrorHandling(operation, operationName) {
    try {
        return await operation();
    }
    catch (error) {
        console.error(`DynamoDB ${operationName} error:`, error);
        if (error instanceof Error) {
            // Handle specific DynamoDB errors
            if (error.name === 'ResourceNotFoundException') {
                throw new Error(`Table not found for ${operationName}`);
            }
            if (error.name === 'ValidationException') {
                throw new Error(`Invalid parameters for ${operationName}: ${error.message}`);
            }
            if (error.name === 'ConditionalCheckFailedException') {
                throw new Error(`Conditional check failed for ${operationName}`);
            }
            if (error.name === 'ProvisionedThroughputExceededException') {
                throw new Error(`Throughput exceeded for ${operationName}. Please retry.`);
            }
        }
        throw new Error(`${operationName} failed: ${error}`);
    }
}
// Utility functions for key generation
function generateTransactionKey(date, transactionId) {
    const dateStr = date.toISOString().split('T')[0]; // yyyy-mm-dd
    return `DT#${dateStr}#TX#${transactionId}`;
}
function generateUserWeekKey(userId, date) {
    const year = date.getFullYear();
    const week = getISOWeek(date);
    return `USER#${userId}#W#${year}-W${week.toString().padStart(2, '0')}`;
}
function generateWeekKey(date) {
    const year = date.getFullYear();
    const week = getISOWeek(date);
    return `W#${year}-W${week.toString().padStart(2, '0')}`;
}
function generateUserKey(userId) {
    return `USER#${userId}`;
}
function generateScopeKey(scope) {
    return `SCOPE#${scope}`;
}
// ISO week calculation
function getISOWeek(date) {
    const target = new Date(date.valueOf());
    const dayNumber = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
// TTL calculation for agent memory (30 days from now)
function generateTTL(daysFromNow = 30) {
    return Math.floor(Date.now() / 1000) + (daysFromNow * 24 * 60 * 60);
}
