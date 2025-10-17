/**
 * Autonomous Runs Database Operations
 * Tracks autonomous system operations for UI display and monitoring
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDBClient } from './dynamodb-client';

const AUTONOMOUS_RUNS_TABLE = process.env.AUTONOMOUS_RUNS_TABLE || 'spending-insights-autonomous-runs';

export interface AutonomousRun {
  runType: string; // 'weekly-insights', 'fee-detection', etc.
  runTimestamp: string; // ISO timestamp
  status: 'started' | 'completed' | 'failed';
  duration?: number; // Duration in milliseconds
  usersProcessed?: number;
  insightsGenerated?: number;
  recommendationsCreated?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get the latest autonomous run for a specific type
 */
export async function getLatestAutonomousRun(runType: string): Promise<AutonomousRun | null> {
  const client = getDynamoDBClient();
  
  const command = new QueryCommand({
    TableName: AUTONOMOUS_RUNS_TABLE,
    KeyConditionExpression: 'runType = :runType',
    ExpressionAttributeValues: {
      ':runType': runType
    },
    ScanIndexForward: false, // Sort descending by timestamp
    Limit: 1
  });

  const result = await client.send(command);
  
  if (result.Items && result.Items.length > 0) {
    return result.Items[0] as AutonomousRun;
  }
  
  return null;
}

/**
 * Get recent autonomous runs for monitoring
 */
export async function getRecentAutonomousRuns(
  runType?: string,
  limit: number = 10
): Promise<AutonomousRun[]> {
  const client = getDynamoDBClient();
  
  if (runType) {
    const command = new QueryCommand({
      TableName: AUTONOMOUS_RUNS_TABLE,
      KeyConditionExpression: 'runType = :runType',
      ExpressionAttributeValues: {
        ':runType': runType
      },
      ScanIndexForward: false, // Sort descending by timestamp
      Limit: limit
    });

    const result = await client.send(command);
    return (result.Items || []) as AutonomousRun[];
  } else {
    // Get all recent runs across all types (would need a different query strategy in production)
    // For now, just get weekly-insights runs
    return getRecentAutonomousRuns('weekly-insights', limit);
  }
}

/**
 * Get autonomous run statistics for dashboard
 */
export async function getAutonomousRunStats(runType: string, days: number = 7): Promise<{
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  totalUsersProcessed: number;
  totalInsightsGenerated: number;
}> {
  const client = getDynamoDBClient();
  
  // Calculate date threshold
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);
  const thresholdTimestamp = thresholdDate.toISOString();
  
  const command = new QueryCommand({
    TableName: AUTONOMOUS_RUNS_TABLE,
    KeyConditionExpression: 'runType = :runType AND runTimestamp >= :threshold',
    ExpressionAttributeValues: {
      ':runType': runType,
      ':threshold': thresholdTimestamp
    },
    ScanIndexForward: false
  });

  const result = await client.send(command);
  const runs = (result.Items || []) as AutonomousRun[];
  
  const stats = {
    totalRuns: runs.length,
    successfulRuns: runs.filter(r => r.status === 'completed').length,
    failedRuns: runs.filter(r => r.status === 'failed').length,
    averageDuration: 0,
    totalUsersProcessed: 0,
    totalInsightsGenerated: 0
  };
  
  if (runs.length > 0) {
    const completedRuns = runs.filter(r => r.status === 'completed' && r.duration);
    if (completedRuns.length > 0) {
      stats.averageDuration = completedRuns.reduce((sum, r) => sum + (r.duration || 0), 0) / completedRuns.length;
    }
    
    stats.totalUsersProcessed = runs.reduce((sum, r) => sum + (r.usersProcessed || 0), 0);
    stats.totalInsightsGenerated = runs.reduce((sum, r) => sum + (r.insightsGenerated || 0), 0);
  }
  
  return stats;
}