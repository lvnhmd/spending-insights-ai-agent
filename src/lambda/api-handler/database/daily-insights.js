"use strict";
/**
 * DynamoDB CRUD operations for daily insights table (API Handler)
 * Requirements: 7.6, 8.1, 1.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyInsight = getDailyInsight;
exports.getDailyInsightsByDateRange = getDailyInsightsByDateRange;
exports.getLatestDailyInsight = getLatestDailyInsight;
exports.getDailyInsightsForUser = getDailyInsightsForUser;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_client_1 = require("./dynamodb-client");
// Get daily insight by date
async function getDailyInsight(userId, analysisDate) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    // Use date as weekKey for now to work with existing table structure
    const dateKey = `DAILY#${analysisDate.toISOString().split('T')[0]}`;
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
            Key: {
                userId: userKey,
                weekKey: dateKey, // Using weekKey field but with daily data
            },
        }));
    }, 'getDailyInsight');
    if (!result.Item) {
        return null;
    }
    return recordToDailyInsight(result.Item);
}
// Get daily insights for a user within date range
async function getDailyInsightsByDateRange(userId, startDate, endDate) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const startKey = `DAILY#${startDate.toISOString().split('T')[0]}`;
    const endKey = `DAILY#${endDate.toISOString().split('T')[0]}`;
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
            KeyConditionExpression: 'userId = :userId AND weekKey BETWEEN :startKey AND :endKey',
            ExpressionAttributeValues: {
                ':userId': userKey,
                ':startKey': startKey,
                ':endKey': endKey,
            },
        }));
    }, 'getDailyInsightsByDateRange');
    return (result.Items || []).map(item => recordToDailyInsight(item));
}
// Get latest daily insight for a user
async function getLatestDailyInsight(userId) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
            KeyConditionExpression: 'userId = :userId AND begins_with(weekKey, :dailyPrefix)',
            ExpressionAttributeValues: {
                ':userId': userKey,
                ':dailyPrefix': 'DAILY#',
            },
            ScanIndexForward: false, // Sort descending by weekKey (which contains date)
            Limit: 1,
        }));
    }, 'getLatestDailyInsight');
    if (!result.Items || result.Items.length === 0) {
        return null;
    }
    return recordToDailyInsight(result.Items[0]);
}
// Get multiple daily insights for a user (most recent first)
async function getDailyInsightsForUser(userId, limit = 10) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
            KeyConditionExpression: 'userId = :userId AND begins_with(weekKey, :dailyPrefix)',
            ExpressionAttributeValues: {
                ':userId': userKey,
                ':dailyPrefix': 'DAILY#',
            },
            ScanIndexForward: false, // Sort descending by weekKey (which contains date)
            Limit: limit,
        }));
    }, 'getDailyInsightsForUser');
    return (result.Items || []).map(item => recordToDailyInsight(item));
}
// Helper function to convert DynamoDB record to DailyInsight
function recordToDailyInsight(record) {
    return {
        id: `${record.userId}-${record.weekKey}`,
        userId: record.userId.replace('USER#', ''),
        analysisDate: new Date(record.analysisDate),
        analysisStartDate: new Date(record.analysisStartDate),
        analysisEndDate: new Date(record.analysisEndDate),
        totalSpent: record.totalSpent,
        topCategories: record.topCategories,
        recommendations: record.recommendations,
        potentialSavings: record.potentialSavings,
        implementedActions: record.implementedActions,
        generatedAt: new Date(record.generatedAt),
        transactionCount: record.transactionCount,
    };
}
