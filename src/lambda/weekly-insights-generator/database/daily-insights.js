"use strict";
/**
 * DynamoDB CRUD operations for daily insights table
 * Requirements: 7.6, 8.1, 1.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDailyInsight = createDailyInsight;
exports.getDailyInsight = getDailyInsight;
exports.getDailyInsightsByDateRange = getDailyInsightsByDateRange;
exports.getLatestDailyInsight = getLatestDailyInsight;
exports.updateDailyInsight = updateDailyInsight;
exports.deleteDailyInsight = deleteDailyInsight;
exports.markRecommendationImplemented = markRecommendationImplemented;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_client_1 = require("./dynamodb-client");
// Create daily insight
async function createDailyInsight(insight) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(insight.userId);
    const now = new Date().toISOString();
    const dateKey = `DAILY#${insight.analysisDate.toISOString().split('T')[0]}`;
    const record = {
        userId: userKey,
        weekKey: dateKey, // Using weekKey field but with daily format
        analysisDate: insight.analysisDate.toISOString(),
        analysisStartDate: insight.analysisStartDate.toISOString(),
        analysisEndDate: insight.analysisEndDate.toISOString(),
        totalSpent: insight.totalSpent,
        topCategories: insight.topCategories,
        recommendations: insight.recommendations,
        potentialSavings: insight.potentialSavings,
        implementedActions: insight.implementedActions,
        generatedAt: insight.generatedAt.toISOString(),
        transactionCount: insight.transactionCount,
        createdAt: now,
        updatedAt: now,
    };
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
            Item: record,
        }));
    }, 'createDailyInsight');
}
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
// Update daily insight
async function updateDailyInsight(userId, analysisDate, updates) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const dateKey = `DAILY#${analysisDate.toISOString().split('T')[0]}`;
    const now = new Date().toISOString();
    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'userId' && key !== 'analysisDate') {
            const attrName = `#${key}`;
            const attrValue = `:${key}`;
            updateExpressions.push(`${attrName} = ${attrValue}`);
            expressionAttributeNames[attrName] = key;
            // Handle date conversion
            if ((key.includes('Date') || key === 'generatedAt') && value instanceof Date) {
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
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
            Key: {
                userId: userKey,
                weekKey: dateKey, // Using weekKey field
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }));
    }, 'updateDailyInsight');
}
// Delete daily insight
async function deleteDailyInsight(userId, analysisDate) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const dateKey = `DAILY#${analysisDate.toISOString().split('T')[0]}`;
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.DeleteCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
            Key: {
                userId: userKey,
                weekKey: dateKey, // Using weekKey field
            },
        }));
    }, 'deleteDailyInsight');
}
// Mark recommendation as implemented
async function markRecommendationImplemented(userId, analysisDate, recommendationId) {
    const insight = await getDailyInsight(userId, analysisDate);
    if (insight) {
        const implementedActions = [...insight.implementedActions, recommendationId];
        await updateDailyInsight(userId, analysisDate, { implementedActions });
    }
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
