/**
 * DynamoDB CRUD operations for weekly insights table
 * Requirements: 7.6, 8.1, 1.5
 */

import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES, withErrorHandling, generateWeekKey, generateUserKey } from './dynamodb-client';
import { WeeklyInsight } from '../types';

export interface WeeklyInsightRecord {
  userId: string;
  weekKey: string; // W#isoWeek
  totalSpent: number;
  topCategories: any[]; // JSON array
  recommendations: any[]; // JSON array
  potentialSavings: number;
  implementedActions: string[];
  generatedAt: string;
  weekNumber: number;
  year: number;
  createdAt: string;
  updatedAt: string;
}

// Create weekly insight
export async function createWeeklyInsight(insight: WeeklyInsight): Promise<void> {
  const userKey = generateUserKey(insight.userId);
  const weekKey = generateWeekKey(insight.weekOf);
  const now = new Date().toISOString();

  const record: WeeklyInsightRecord = {
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

  await withErrorHandling(async () => {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS,
      Item: record,
    }));
  }, 'createWeeklyInsight');
}

// Get weekly insight
export async function getWeeklyInsight(userId: string, weekOf: Date): Promise<WeeklyInsight | null> {
  const userKey = generateUserKey(userId);
  const weekKey = generateWeekKey(weekOf);

  const result = await withErrorHandling(async () => {
    return await docClient.send(new GetCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS,
      Key: {
        userId: userKey,
        weekKey,
      },
    }));
  }, 'getWeeklyInsight');

  if (!result.Item) {
    return null;
  }

  return recordToWeeklyInsight(result.Item as WeeklyInsightRecord);
}

// Get all weekly insights for a user
export async function getWeeklyInsightsForUser(userId: string, limit?: number): Promise<WeeklyInsight[]> {
  const userKey = generateUserKey(userId);

  const result = await withErrorHandling(async () => {
    return await docClient.send(new QueryCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userKey,
      },
      ScanIndexForward: false, // Get most recent first
      Limit: limit,
    }));
  }, 'getWeeklyInsightsForUser');

  return (result.Items || []).map(item => recordToWeeklyInsight(item as WeeklyInsightRecord));
}

// Get weekly insights for a date range
export async function getWeeklyInsightsByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<WeeklyInsight[]> {
  const userKey = generateUserKey(userId);
  const startWeekKey = generateWeekKey(startDate);
  const endWeekKey = generateWeekKey(endDate);

  const result = await withErrorHandling(async () => {
    return await docClient.send(new QueryCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS,
      KeyConditionExpression: 'userId = :userId AND weekKey BETWEEN :startWeek AND :endWeek',
      ExpressionAttributeValues: {
        ':userId': userKey,
        ':startWeek': startWeekKey,
        ':endWeek': endWeekKey,
      },
      ScanIndexForward: false, // Get most recent first
    }));
  }, 'getWeeklyInsightsByDateRange');

  return (result.Items || []).map(item => recordToWeeklyInsight(item as WeeklyInsightRecord));
}

// Update weekly insight
export async function updateWeeklyInsight(
  userId: string,
  weekOf: Date,
  updates: Partial<WeeklyInsight>
): Promise<void> {
  const userKey = generateUserKey(userId);
  const weekKey = generateWeekKey(weekOf);
  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && key !== 'id' && key !== 'userId' && key !== 'weekOf') {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      
      // Handle date conversion
      if (key === 'generatedAt' && value instanceof Date) {
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
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS,
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
export async function deleteWeeklyInsight(userId: string, weekOf: Date): Promise<void> {
  const userKey = generateUserKey(userId);
  const weekKey = generateWeekKey(weekOf);

  await withErrorHandling(async () => {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAMES.WEEKLY_INSIGHTS,
      Key: {
        userId: userKey,
        weekKey,
      },
    }));
  }, 'deleteWeeklyInsight');
}

// Get latest weekly insight for user
export async function getLatestWeeklyInsight(userId: string): Promise<WeeklyInsight | null> {
  const insights = await getWeeklyInsightsForUser(userId, 1);
  return insights.length > 0 ? insights[0] : null;
}

// Helper function to convert DynamoDB record to WeeklyInsight
function recordToWeeklyInsight(record: WeeklyInsightRecord): WeeklyInsight {
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