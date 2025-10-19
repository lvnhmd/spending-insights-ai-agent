/**
 * DynamoDB CRUD operations for transactions table
 * Requirements: 7.6, 8.1, 1.5
 */

import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES, withErrorHandling, generateTransactionKey, generateUserWeekKey, generateUserKey } from './dynamodb-client';
import { Transaction } from '../types';

export interface TransactionRecord {
    userId: string;
    transactionKey: string; // DT#yyyy-mm-dd#TX#txId
    userWeekKey: string; // USER#userId#W#isoWeek
    category: string;
    amount: number;
    description: string;
    date: string; // ISO date string
    account: string;
    isRecurring: boolean;
    confidence: number;
    subcategory?: string;
    originalDescription?: string;
    merchantName?: string;
    transactionType: 'debit' | 'credit';
    createdAt: string;
    updatedAt: string;
}

// Create transaction
export async function createTransaction(transaction: Transaction): Promise<void> {
    const transactionKey = generateTransactionKey(transaction.date, transaction.id);
    const userWeekKey = generateUserWeekKey(transaction.userId, transaction.date);
    const now = new Date().toISOString();

    const record: TransactionRecord = {
        userId: generateUserKey(transaction.userId),
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

    await withErrorHandling(async () => {
        await docClient.send(new PutCommand({
            TableName: TABLE_NAMES.TRANSACTIONS,
            Item: record,
        }));
    }, 'createTransaction');
}

// Get transaction by ID
export async function getTransaction(userId: string, transactionId: string, date: Date): Promise<Transaction | null> {
    const userKey = generateUserKey(userId);
    const transactionKey = generateTransactionKey(date, transactionId);

    const result = await withErrorHandling(async () => {
        return await docClient.send(new GetCommand({
            TableName: TABLE_NAMES.TRANSACTIONS,
            Key: {
                userId: userKey,
                transactionKey,
            },
        }));
    }, 'getTransaction');

    if (!result.Item) {
        return null;
    }

    return recordToTransaction(result.Item as TransactionRecord);
}

// Get transactions for a user within date range
export async function getTransactionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<Transaction[]> {
    const userKey = generateUserKey(userId);
    const startKey = generateTransactionKey(startDate, '');
    const endKey = generateTransactionKey(endDate, 'ZZZZ'); // Use high sort value for range end

    const result = await withErrorHandling(async () => {
        return await docClient.send(new QueryCommand({
            TableName: TABLE_NAMES.TRANSACTIONS,
            KeyConditionExpression: 'userId = :userId AND transactionKey BETWEEN :startKey AND :endKey',
            ExpressionAttributeValues: {
                ':userId': userKey,
                ':startKey': startKey,
                ':endKey': endKey,
            },
        }));
    }, 'getTransactionsByDateRange');

    return (result.Items || []).map(item => recordToTransaction(item as TransactionRecord));
}

// Get all transactions for a user (most recent first)
export async function getAllTransactionsForUser(userId: string, limit?: number): Promise<Transaction[]> {
    const userKey = generateUserKey(userId);

    const result = await withErrorHandling(async () => {
        return await docClient.send(new QueryCommand({
            TableName: TABLE_NAMES.TRANSACTIONS,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userKey,
            },
            ScanIndexForward: false, // Sort descending by transactionKey (which includes date)
            ...(limit && { Limit: limit }),
        }));
    }, 'getAllTransactionsForUser');

    return (result.Items || []).map(item => recordToTransaction(item as TransactionRecord));
}

// Get transactions for a specific week using GSI
export async function getTransactionsByWeek(userId: string, date: Date): Promise<Transaction[]> {
    const userWeekKey = generateUserWeekKey(userId, date);

    const result = await withErrorHandling(async () => {
        return await docClient.send(new QueryCommand({
            TableName: TABLE_NAMES.TRANSACTIONS,
            IndexName: 'userWeekIdx',
            KeyConditionExpression: 'userWeekKey = :userWeekKey',
            ExpressionAttributeValues: {
                ':userWeekKey': userWeekKey,
            },
        }));
    }, 'getTransactionsByWeek');

    return (result.Items || []).map(item => recordToTransaction(item as TransactionRecord));
}

// Get transactions by category for a week
export async function getTransactionsByWeekAndCategory(
    userId: string,
    date: Date,
    category: string
): Promise<Transaction[]> {
    const userWeekKey = generateUserWeekKey(userId, date);

    const result = await withErrorHandling(async () => {
        return await docClient.send(new QueryCommand({
            TableName: TABLE_NAMES.TRANSACTIONS,
            IndexName: 'userWeekIdx',
            KeyConditionExpression: 'userWeekKey = :userWeekKey AND category = :category',
            ExpressionAttributeValues: {
                ':userWeekKey': userWeekKey,
                ':category': category,
            },
        }));
    }, 'getTransactionsByWeekAndCategory');

    return (result.Items || []).map(item => recordToTransaction(item as TransactionRecord));
}

// Update transaction
export async function updateTransaction(
    userId: string,
    transactionId: string,
    date: Date,
    updates: Partial<Transaction>
): Promise<void> {
    const userKey = generateUserKey(userId);
    const transactionKey = generateTransactionKey(date, transactionId);
    const now = new Date().toISOString();

    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

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

    await withErrorHandling(async () => {
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAMES.TRANSACTIONS,
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
export async function deleteTransaction(userId: string, transactionId: string, date: Date): Promise<void> {
    const userKey = generateUserKey(userId);
    const transactionKey = generateTransactionKey(date, transactionId);

    await withErrorHandling(async () => {
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAMES.TRANSACTIONS,
            Key: {
                userId: userKey,
                transactionKey,
            },
        }));
    }, 'deleteTransaction');
}

// Batch create transactions
export async function batchCreateTransactions(transactions: Transaction[]): Promise<void> {
    // For simplicity, we'll process them one by one
    // In production, you'd want to use BatchWriteCommand for better performance
    for (const transaction of transactions) {
        await createTransaction(transaction);
    }
}

// Helper function to convert DynamoDB record to Transaction
function recordToTransaction(record: TransactionRecord): Transaction {
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