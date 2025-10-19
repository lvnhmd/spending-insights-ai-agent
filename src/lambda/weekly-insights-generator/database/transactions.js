"use strict";
/**
 * DynamoDB CRUD operations for transactions table
 * Requirements: 7.6, 8.1, 1.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransaction = createTransaction;
exports.getTransaction = getTransaction;
exports.getTransactionsByDateRange = getTransactionsByDateRange;
exports.getAllTransactionsForUser = getAllTransactionsForUser;
exports.getTransactionsByWeek = getTransactionsByWeek;
exports.getTransactionsByWeekAndCategory = getTransactionsByWeekAndCategory;
exports.updateTransaction = updateTransaction;
exports.deleteTransaction = deleteTransaction;
exports.batchCreateTransactions = batchCreateTransactions;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_client_1 = require("./dynamodb-client");
// Create transaction
async function createTransaction(transaction) {
    const transactionKey = (0, dynamodb_client_1.generateTransactionKey)(transaction.date, transaction.id);
    const userWeekKey = (0, dynamodb_client_1.generateUserWeekKey)(transaction.userId, transaction.date);
    const now = new Date().toISOString();
    const record = {
        userId: (0, dynamodb_client_1.generateUserKey)(transaction.userId),
        transactionKey,
        userWeekKey,
        category: transaction.category,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date.toISOString(),
        account: transaction.account,
        isRecurring: transaction.isRecurring,
        confidence: transaction.confidence,
        subcategory: transaction.subcategory,
        originalDescription: transaction.originalDescription,
        merchantName: transaction.merchantName,
        transactionType: transaction.transactionType,
        createdAt: now,
        updatedAt: now,
    };
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.TRANSACTIONS,
            Item: record,
        }));
    }, 'createTransaction');
}
// Get transaction by ID
async function getTransaction(userId, transactionId, date) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const transactionKey = (0, dynamodb_client_1.generateTransactionKey)(date, transactionId);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.TRANSACTIONS,
            Key: {
                userId: userKey,
                transactionKey,
            },
        }));
    }, 'getTransaction');
    if (!result.Item) {
        return null;
    }
    return recordToTransaction(result.Item);
}
// Get transactions for a user within date range
async function getTransactionsByDateRange(userId, startDate, endDate) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const startKey = (0, dynamodb_client_1.generateTransactionKey)(startDate, '');
    const endKey = (0, dynamodb_client_1.generateTransactionKey)(endDate, 'ZZZZ'); // Use high sort value for range end
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.TRANSACTIONS,
            KeyConditionExpression: 'userId = :userId AND transactionKey BETWEEN :startKey AND :endKey',
            ExpressionAttributeValues: {
                ':userId': userKey,
                ':startKey': startKey,
                ':endKey': endKey,
            },
        }));
    }, 'getTransactionsByDateRange');
    return (result.Items || []).map(item => recordToTransaction(item));
}
// Get all transactions for a user (most recent first)
async function getAllTransactionsForUser(userId, limit) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.TRANSACTIONS,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userKey,
            },
            ScanIndexForward: false, // Sort descending by transactionKey (which includes date)
            ...(limit && { Limit: limit }),
        }));
    }, 'getAllTransactionsForUser');
    return (result.Items || []).map(item => recordToTransaction(item));
}
// Get transactions for a specific week using GSI
async function getTransactionsByWeek(userId, date) {
    const userWeekKey = (0, dynamodb_client_1.generateUserWeekKey)(userId, date);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.TRANSACTIONS,
            IndexName: 'userWeekIdx',
            KeyConditionExpression: 'userWeekKey = :userWeekKey',
            ExpressionAttributeValues: {
                ':userWeekKey': userWeekKey,
            },
        }));
    }, 'getTransactionsByWeek');
    return (result.Items || []).map(item => recordToTransaction(item));
}
// Get transactions by category for a week
async function getTransactionsByWeekAndCategory(userId, date, category) {
    const userWeekKey = (0, dynamodb_client_1.generateUserWeekKey)(userId, date);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.TRANSACTIONS,
            IndexName: 'userWeekIdx',
            KeyConditionExpression: 'userWeekKey = :userWeekKey AND category = :category',
            ExpressionAttributeValues: {
                ':userWeekKey': userWeekKey,
                ':category': category,
            },
        }));
    }, 'getTransactionsByWeekAndCategory');
    return (result.Items || []).map(item => recordToTransaction(item));
}
// Update transaction
async function updateTransaction(userId, transactionId, date, updates) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const transactionKey = (0, dynamodb_client_1.generateTransactionKey)(date, transactionId);
    const now = new Date().toISOString();
    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'userId') {
            const attrName = `#${key}`;
            const attrValue = `:${key}`;
            updateExpressions.push(`${attrName} = ${attrValue}`);
            expressionAttributeNames[attrName] = key;
            expressionAttributeValues[attrValue] = key === 'date' && value instanceof Date ? value.toISOString() : value;
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
            TableName: dynamodb_client_1.TABLE_NAMES.TRANSACTIONS,
            Key: {
                userId: userKey,
                transactionKey,
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }));
    }, 'updateTransaction');
}
// Delete transaction
async function deleteTransaction(userId, transactionId, date) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const transactionKey = (0, dynamodb_client_1.generateTransactionKey)(date, transactionId);
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.DeleteCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.TRANSACTIONS,
            Key: {
                userId: userKey,
                transactionKey,
            },
        }));
    }, 'deleteTransaction');
}
// Batch create transactions
async function batchCreateTransactions(transactions) {
    // For simplicity, we'll process them one by one
    // In production, you'd want to use BatchWriteCommand for better performance
    for (const transaction of transactions) {
        await createTransaction(transaction);
    }
}
// Helper function to convert DynamoDB record to Transaction
function recordToTransaction(record) {
    return {
        id: record.transactionKey.split('#TX#')[1],
        userId: record.userId.replace('USER#', ''),
        amount: record.amount,
        description: record.description,
        category: record.category,
        subcategory: record.subcategory,
        date: new Date(record.date),
        account: record.account,
        isRecurring: record.isRecurring,
        confidence: record.confidence,
        originalDescription: record.originalDescription,
        merchantName: record.merchantName,
        transactionType: record.transactionType,
    };
}
