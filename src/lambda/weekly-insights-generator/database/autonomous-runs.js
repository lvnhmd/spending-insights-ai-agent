"use strict";
/**
 * Autonomous Runs Database Operations
 * Tracks autonomous system operations for UI display and monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAutonomousRun = startAutonomousRun;
exports.completeAutonomousRun = completeAutonomousRun;
exports.failAutonomousRun = failAutonomousRun;
exports.getLatestAutonomousRun = getLatestAutonomousRun;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_client_1 = require("./dynamodb-client");
const AUTONOMOUS_RUNS_TABLE = process.env.AUTONOMOUS_RUNS_TABLE || 'spending-insights-autonomous-runs';
/**
 * Record the start of an autonomous run
 */
async function startAutonomousRun(runType, metadata) {
    const client = dynamodb_client_1.docClient;
    const timestamp = new Date().toISOString();
    const autonomousRun = {
        runType,
        runTimestamp: timestamp,
        status: 'started',
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const command = new lib_dynamodb_1.PutCommand({
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
async function completeAutonomousRun(runType, runTimestamp, results) {
    const client = dynamodb_client_1.docClient;
    const command = new lib_dynamodb_1.UpdateCommand({
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
async function failAutonomousRun(runType, runTimestamp, errorMessage, duration) {
    const client = dynamodb_client_1.docClient;
    const command = new lib_dynamodb_1.UpdateCommand({
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
async function getLatestAutonomousRun(runType) {
    const client = dynamodb_client_1.docClient;
    const command = new lib_dynamodb_1.QueryCommand({
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
        return result.Items[0];
    }
    return null;
}
