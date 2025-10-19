/**
 * DynamoDB CRUD operations for daily insights table
 * Requirements: 7.6, 8.1, 1.5
 */

import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES, withErrorHandling, generateUserKey } from './dynamodb-client';
import { DailyInsight } from '../types';

export interface DailyInsightRecord {
  userId: string;
  weekKey: string; // Using existing weekKey field but with daily format: DAILY#yyyy-mm-dd
  analysisDate: string; // ISO date string
  analysisStartDate: string; // ISO date string
  analysisEndDate: string; // ISO date string
  totalSpent: number;
  topCategories: any[];
  recommendations: any[];
  potentialSavings: number;
  implementedActions: any[];
  generatedAt: string;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

// Create daily insight
export async function createDailyInsight(insight: DailyInsight): Promise<void> {
  const userKey = generateUserKey(insight.userId);
  const now = new Date().toISOString();
  const dateKey = `DAILY#${insight.analysisDate.toISOString().split('T')[0]}`;

  const record: DailyInsightRecord = {
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

  await withErrorHandling(async () => {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
      Item: record,
    }));
  }, 'createDailyInsight');
}

// Get daily insight by date
export async function getDailyInsight(userId: string, analysisDate: Date): Promise<DailyInsight | null> {
  const userKey = generateUserKey(userId);
  // Use date as weekKey for now to work with existing table structure
  const dateKey = `DAILY#${analysisDate.toISOString().split('T')[0]}`;

  const result = await withErrorHandling(async () => {
    return await docClient.send(new GetCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
      Key: {
        userId: userKey,
        weekKey: dateKey, // Using weekKey field but with daily data
      },
    }));
  }, 'getDailyInsight');

  if (!result.Item) {
    return null;
  }

  return recordToDailyInsight(result.Item as DailyInsightRecord);
}

// Get daily insights for a user within date range
export async function getDailyInsightsByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<DailyInsight[]> {
  const userKey = generateUserKey(userId);
  const startKey = `DAILY#${startDate.toISOString().split('T')[0]}`;
  const endKey = `DAILY#${endDate.toISOString().split('T')[0]}`;

  const result = await withErrorHandling(async () => {
    return await docClient.send(new QueryCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
      KeyConditionExpression: 'userId = :userId AND weekKey BETWEEN :startKey AND :endKey',
      ExpressionAttributeValues: {
        ':userId': userKey,
        ':startKey': startKey,
        ':endKey': endKey,
      },
    }));
  }, 'getDailyInsightsByDateRange');

  return (result.Items || []).map(item => recordToDailyInsight(item as DailyInsightRecord));
}

// Get latest daily insight for a user
export async function getLatestDailyInsight(userId: string): Promise<DailyInsight | null> {
  const userKey = generateUserKey(userId);

  const result = await withErrorHandling(async () => {
    return await docClient.send(new QueryCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
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

  return recordToDailyInsight(result.Items[0] as DailyInsightRecord);
}

// Update daily insight
export async function updateDailyInsight(
  userId: string,
  analysisDate: Date,
  updates: Partial<DailyInsight>
): Promise<void> {
  const userKey = generateUserKey(userId);
  const dateKey = `DAILY#${analysisDate.toISOString().split('T')[0]}`;
  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && key !== 'id' && key !== 'userId' && key !== 'analysisDate') {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;

      // Handle date conversion
      if ((key.includes('Date') || key === 'generatedAt') && value instanceof Date) {
        expressionAttributeValues[attrValue] = value.toISOString();
      } else {
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

  await withErrorHandling(async () => {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
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
export async function deleteDailyInsight(userId: string, analysisDate: Date): Promise<void> {
  const userKey = generateUserKey(userId);
  const dateKey = `DAILY#${analysisDate.toISOString().split('T')[0]}`;

  await withErrorHandling(async () => {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS, // Will rename this table later
      Key: {
        userId: userKey,
        weekKey: dateKey, // Using weekKey field
      },
    }));
  }, 'deleteDailyInsight');
}

// Mark recommendation as implemented
export async function markRecommendationImplemented(
  userId: string,
  analysisDate: Date,
  recommendationId: string
): Promise<void> {
  const insight = await getDailyInsight(userId, analysisDate);
  if (insight) {
    const implementedActions = [...insight.implementedActions, recommendationId];
    await updateDailyInsight(userId, analysisDate, { implementedActions });
  }
}

// Helper function to convert DynamoDB record to DailyInsight
function recordToDailyInsight(record: DailyInsightRecord): DailyInsight {
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