/**
 * Autonomous Runs Database Operations
 * Tracks autonomous system operations for UI display and monitoring
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamodb-client';

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
  const client = docClient;
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
  const client = docClient;
  
  const command = new UpdateCommand({
    TableName: AUTONOMOUS_RUNS_TABLE,
    Key: {
      runType,
      runTimestamp
    },
    UpdateExpression: 'SET #status = :status, #usersProcessed = :usersProcessed, #insightsGenerated = :insightsGenerated, #recommendationsCreated = :recommendationsCreated, #duration = :duration, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#usersProcessed': 'usersProcessed',
      '#insightsGenerated': 'insightsGenerated',
      '#recommendationsCreated': 'recommendationsCreated',
      '#duration': 'duration',
      '#updatedAt': 'updatedAt'
    },
    ExpressionAttributeValues: {
      ':status': 'completed',
      ':usersProcessed': results.usersProcessed || 0,
      ':insightsGenerated': results.insightsGenerated || 0,
      ':recommendationsCreated': results.recommendationsCreated || 0,
      ':duration': results.duration || 0,
      ':updatedAt': new Date()
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
  const client = docClient;
  
  const command = new UpdateCommand({
    TableName: AUTONOMOUS_RUNS_TABLE,
    Key: {
      runType,
      runTimestamp
    },
    UpdateExpression: 'SET #status = :status, #errorMessage = :errorMessage, #duration = :duration, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#errorMessage': 'errorMessage',
      '#duration': 'duration',
      '#updatedAt': 'updatedAt'
    },
    ExpressionAttributeValues: {
      ':status': 'failed',
      ':errorMessage': errorMessage,
      ':duration': duration || 0,
      ':updatedAt': new Date()
    }
  });

  await client.send(command);
  console.log(`Failed autonomous run: ${runType} at ${runTimestamp} - ${errorMessage}`);
}

/**
 * Get the latest autonomous run for a specific type
 */
export async function getLatestAutonomousRun(runType: string): Promise<AutonomousRun | null> {
  const client = docClient;
  
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