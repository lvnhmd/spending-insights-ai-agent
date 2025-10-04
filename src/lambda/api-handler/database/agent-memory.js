"use strict";
/**
 * DynamoDB CRUD operations for agent memory table
 * Requirements: 7.6, 8.1, 1.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEMORY_SCOPES = void 0;
exports.setAgentMemory = setAgentMemory;
exports.getAgentMemory = getAgentMemory;
exports.getAllAgentMemory = getAllAgentMemory;
exports.updateAgentMemory = updateAgentMemory;
exports.deleteAgentMemory = deleteAgentMemory;
exports.setSessionMemory = setSessionMemory;
exports.getSessionMemory = getSessionMemory;
exports.setPreferencesMemory = setPreferencesMemory;
exports.getPreferencesMemory = getPreferencesMemory;
exports.setCategoryMappings = setCategoryMappings;
exports.getCategoryMappings = getCategoryMappings;
exports.addConversationTurn = addConversationTurn;
exports.getConversationHistory = getConversationHistory;
exports.setLastAnalysisDate = setLastAnalysisDate;
exports.getLastAnalysisDate = getLastAnalysisDate;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_client_1 = require("./dynamodb-client");
// Memory scopes
exports.MEMORY_SCOPES = {
    SESSION: 'session',
    PREFERENCES: 'preferences',
    CATEGORIES: 'categories',
    CONVERSATION: 'conversation',
    ANALYSIS: 'analysis',
};
// Create or update agent memory
async function setAgentMemory(userId, scope, data, ttlDays) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const scopeKey = (0, dynamodb_client_1.generateScopeKey)(scope);
    const now = new Date().toISOString();
    const record = {
        userId: userKey,
        memoryScope: scopeKey,
        conversationHistory: data.conversationHistory,
        learnedPreferences: data.learnedPreferences,
        categoryMappings: data.categoryMappings,
        lastAnalysisDate: data.lastAnalysisDate?.toISOString(),
        sessionId: data.sessionId,
        ttl: ttlDays ? (0, dynamodb_client_1.generateTTL)(ttlDays) : undefined,
        createdAt: now,
        updatedAt: now,
    };
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.AGENT_MEMORY,
            Item: record,
        }));
    }, 'setAgentMemory');
}
// Get agent memory by scope
async function getAgentMemory(userId, scope) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const scopeKey = (0, dynamodb_client_1.generateScopeKey)(scope);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.AGENT_MEMORY,
            Key: {
                userId: userKey,
                memoryScope: scopeKey,
            },
        }));
    }, 'getAgentMemory');
    if (!result.Item) {
        return null;
    }
    return recordToAgentMemory(result.Item);
}
// Get all memory scopes for a user
async function getAllAgentMemory(userId) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.AGENT_MEMORY,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userKey,
            },
        }));
    }, 'getAllAgentMemory');
    const memoryMap = {};
    (result.Items || []).forEach(item => {
        const record = item;
        const scope = record.memoryScope.replace('SCOPE#', '');
        memoryMap[scope] = recordToAgentMemory(record);
    });
    return memoryMap;
}
// Update agent memory
async function updateAgentMemory(userId, scope, updates, ttlDays) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const scopeKey = (0, dynamodb_client_1.generateScopeKey)(scope);
    const now = new Date().toISOString();
    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'userId') {
            const attrName = `#${key}`;
            const attrValue = `:${key}`;
            updateExpressions.push(`${attrName} = ${attrValue}`);
            expressionAttributeNames[attrName] = key;
            // Handle date conversion
            if (key === 'lastAnalysisDate' && value instanceof Date) {
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
    // Add TTL if specified
    if (ttlDays) {
        updateExpressions.push('#ttl = :ttl');
        expressionAttributeNames['#ttl'] = 'ttl';
        expressionAttributeValues[':ttl'] = (0, dynamodb_client_1.generateTTL)(ttlDays);
    }
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.AGENT_MEMORY,
            Key: {
                userId: userKey,
                memoryScope: scopeKey,
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }));
    }, 'updateAgentMemory');
}
// Delete agent memory
async function deleteAgentMemory(userId, scope) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const scopeKey = (0, dynamodb_client_1.generateScopeKey)(scope);
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.DeleteCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.AGENT_MEMORY,
            Key: {
                userId: userKey,
                memoryScope: scopeKey,
            },
        }));
    }, 'deleteAgentMemory');
}
// Convenience methods for specific memory types
// Session memory (short-term, with TTL)
async function setSessionMemory(userId, sessionId, data) {
    await setAgentMemory(userId, exports.MEMORY_SCOPES.SESSION, { ...data, sessionId }, 1); // 1 day TTL
}
async function getSessionMemory(userId) {
    return await getAgentMemory(userId, exports.MEMORY_SCOPES.SESSION);
}
// Preferences memory (long-term)
async function setPreferencesMemory(userId, preferences) {
    await setAgentMemory(userId, exports.MEMORY_SCOPES.PREFERENCES, { learnedPreferences: preferences });
}
async function getPreferencesMemory(userId) {
    const memory = await getAgentMemory(userId, exports.MEMORY_SCOPES.PREFERENCES);
    return memory?.learnedPreferences || [];
}
// Category mappings memory (long-term)
async function setCategoryMappings(userId, mappings) {
    await setAgentMemory(userId, exports.MEMORY_SCOPES.CATEGORIES, { categoryMappings: mappings });
}
async function getCategoryMappings(userId) {
    const memory = await getAgentMemory(userId, exports.MEMORY_SCOPES.CATEGORIES);
    return memory?.categoryMappings || [];
}
// Conversation history (medium-term, with TTL)
async function addConversationTurn(userId, turn) {
    const existing = await getAgentMemory(userId, exports.MEMORY_SCOPES.CONVERSATION);
    const history = existing?.conversationHistory || [];
    // Keep only last 50 turns to prevent memory bloat
    const updatedHistory = [...history, turn].slice(-50);
    await setAgentMemory(userId, exports.MEMORY_SCOPES.CONVERSATION, { conversationHistory: updatedHistory }, 7); // 7 days TTL
}
async function getConversationHistory(userId) {
    const memory = await getAgentMemory(userId, exports.MEMORY_SCOPES.CONVERSATION);
    return memory?.conversationHistory || [];
}
// Analysis tracking
async function setLastAnalysisDate(userId, date) {
    await setAgentMemory(userId, exports.MEMORY_SCOPES.ANALYSIS, { lastAnalysisDate: date });
}
async function getLastAnalysisDate(userId) {
    const memory = await getAgentMemory(userId, exports.MEMORY_SCOPES.ANALYSIS);
    return memory?.lastAnalysisDate || null;
}
// Helper function to convert DynamoDB record to AgentMemory
function recordToAgentMemory(record) {
    return {
        userId: record.userId.replace('USER#', ''),
        conversationHistory: record.conversationHistory || [],
        learnedPreferences: record.learnedPreferences || [],
        categoryMappings: record.categoryMappings || [],
        lastAnalysisDate: record.lastAnalysisDate ? new Date(record.lastAnalysisDate) : new Date(),
        sessionId: record.sessionId || '',
    };
}
