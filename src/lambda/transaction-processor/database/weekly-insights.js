"use strict";
/**
 * DynamoDB CRUD operations for weekly insights table
 * Requirements: 7.6, 8.1, 1.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWeeklyInsight = createWeeklyInsight;
exports.getWeeklyInsight = getWeeklyInsight;
exports.getWeeklyInsightsForUser = getWeeklyInsightsForUser;
exports.getWeeklyInsightsByDateRange = getWeeklyInsightsByDateRange;
exports.updateWeeklyInsight = updateWeeklyInsight;
exports.deleteWeeklyInsight = deleteWeeklyInsight;
exports.getLatestWeeklyInsight = getLatestWeeklyInsight;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_client_1 = require("./dynamodb-client");
// Create weekly insight
async function createWeeklyInsight(insight) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(insight.userId);
    const weekKey = (0, dynamodb_client_1.generateWeekKey)(insight.weekOf);
    const now = new Date().toISOString();
    const record = {
        userId: userKey,
        weekKey,
        totalSpent: insight.totalSpent,
        topCategories: insight.topCategories,
        recommendations: insight.recommendations,
        potentialSavings: insight.potentialSavings,
        implementedActions: insight.implementedActions,
        generatedAt: insight.generatedAt.toISOString(),
        weekNumber: insight.weekNumber,
        year: insight.year,
        createdAt: now,
        updatedAt: now,
    };
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS,
            Item: record,
        }));
    }, 'createWeeklyInsight');
}
// Get weekly insight
async function getWeeklyInsight(userId, weekOf) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const weekKey = (0, dynamodb_client_1.generateWeekKey)(weekOf);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS,
            Key: {
                userId: userKey,
                weekKey,
            },
        }));
    }, 'getWeeklyInsight');
    if (!result.Item) {
        return null;
    }
    return recordToWeeklyInsight(result.Item);
}
// Get all weekly insights for a user
async function getWeeklyInsightsForUser(userId, limit) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userKey,
            },
            ScanIndexForward: false, // Get most recent first
            Limit: limit,
        }));
    }, 'getWeeklyInsightsForUser');
    return (result.Items || []).map(item => recordToWeeklyInsight(item));
}
// Get weekly insights for a date range
async function getWeeklyInsightsByDateRange(userId, startDate, endDate) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const startWeekKey = (0, dynamodb_client_1.generateWeekKey)(startDate);
    const endWeekKey = (0, dynamodb_client_1.generateWeekKey)(endDate);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS,
            KeyConditionExpression: 'userId = :userId AND weekKey BETWEEN :startWeek AND :endWeek',
            ExpressionAttributeValues: {
                ':userId': userKey,
                ':startWeek': startWeekKey,
                ':endWeek': endWeekKey,
            },
            ScanIndexForward: false, // Get most recent first
        }));
    }, 'getWeeklyInsightsByDateRange');
    return (result.Items || []).map(item => recordToWeeklyInsight(item));
}
// Update weekly insight
async function updateWeeklyInsight(userId, weekOf, updates) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const weekKey = (0, dynamodb_client_1.generateWeekKey)(weekOf);
    const now = new Date().toISOString();
    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'userId' && key !== 'weekOf') {
            const attrName = `#${key}`;
            const attrValue = `:${key}`;
            updateExpressions.push(`${attrName} = ${attrValue}`);
            expressionAttributeNames[attrName] = key;
            // Handle date conversion
            if (key === 'generatedAt' && value instanceof Date) {
                expressionAttributeValues[attrValue] = value.toISOString();
            }
            else {
                expressionAttributeValues[attrValue] = value;
            }
        }
    });
    if (updateExpressions.length === 0) {
        return; // Nothing to update
    }
    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS,
            Key: {
                userId: userKey,
                weekKey,
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }));
    }, 'updateWeeklyInsight');
}
// Delete weekly insight
async function deleteWeeklyInsight(userId, weekOf) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const weekKey = (0, dynamodb_client_1.generateWeekKey)(weekOf);
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.DeleteCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS,
            Key: {
                userId: userKey,
                weekKey,
            },
        }));
    }, 'deleteWeeklyInsight');
}
// Get latest weekly insight for user
async function getLatestWeeklyInsight(userId) {
    const insights = await getWeeklyInsightsForUser(userId, 1);
    return insights.length > 0 ? insights[0] : null;
}
// Helper function to convert DynamoDB record to WeeklyInsight
function recordToWeeklyInsight(record) {
    return {
        id: `${record.userId}-${record.weekKey}`,
        userId: record.userId.replace('USER#', ''),
        weekOf: new Date(record.generatedAt), // Use generatedAt as weekOf approximation
        totalSpent: record.totalSpent,
        topCategories: record.topCategories,
        recommendations: record.recommendations,
        potentialSavings: record.potentialSavings,
        implementedActions: record.implementedActions,
        generatedAt: new Date(record.generatedAt),
        weekNumber: record.weekNumber,
        year: record.year,
    };
}
