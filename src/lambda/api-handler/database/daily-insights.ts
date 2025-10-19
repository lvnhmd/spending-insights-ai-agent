/**
 * DynamoDB CRUD operations for daily insights table (API Handler)
 * Requirements: 7.6, 8.1, 1.5
 */

import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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

// Get multiple daily insights for a user (most recent first)
export async function getDailyInsightsForUser(userId: string, limit: number = 10): Promise<DailyInsight[]> {
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
      Limit: limit,
    }));
  }, 'getDailyInsightsForUser');

  return (result.Items || []).map(item => recordToDailyInsight(item as DailyInsightRecord));
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