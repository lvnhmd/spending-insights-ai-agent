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
 * Record the start of an autonomous run
 */
export async function startAutonomousRun(
  runType: string,
  metadata?: Record<string, any>
): Promise<AutonomousRun> {
  const client = getDynamoDBClient();
  const timestamp = new Date().toISOString();
  
  const autonomousRun: AutonomousRun = {
    runType,
    runTimestamp: timestamp,
    status: 'started',
    metadata,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const command = new PutCommand({
    TableName: AUTONOMOUS_RUNS_TABLE,
    Item: autonomousRun
  });

  await client.send(command);
  console.log(`Started autonomous run: ${runType} at ${timestamp}`);
  
  return autonomousRun;
}

/**
 * Complete an autonomous run with results
 */
export async function completeAutonomousRun(
  runType: string,
  runTimestamp: string,
  results: {
    usersProcessed?: number;
    insightsGenerated?: number;
    recommendationsCreated?: number;
    duration?: number;
  }
): Promise<void> {
  const client = getDynamoDBClient();
  
  const command = new PutCommand({
    TableName: AUTONOMOUS_RUNS_TABLE,
    Item: {
      runType,
      runTimestamp,
      status: 'completed',
      ...results,
      updatedAt: new Date()
    }
  });

  await client.send(command);
  console.log(`Completed autonomous run: ${runType} at ${runTimestamp}`);
}

/**
 * Mark an autonomous run as failed
 */
export async function failAutonomousRun(
  runType: string,
  runTimestamp: string,
  errorMessage: string,
  duration?: number
): Promise<void> {
  const client = getDynamoDBClient();
  
  const command = new PutCommand({
    TableName: AUTONOMOUS_RUNS_TABLE,
    Item: {
      runType,
      runTimestamp,
      status: 'failed',
      errorMessage,
      duration,
      updatedAt: new Date()
    }
  });

  await client.send(command);
  console.log(`Failed autonomous run: ${runType} at ${runTimestamp} - ${errorMessage}`);
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