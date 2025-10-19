"use strict";
/**
 * Autonomous Runs Database Operations
 * Tracks autonomous system operations for UI display and monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestAutonomousRun = getLatestAutonomousRun;
exports.getRecentAutonomousRuns = getRecentAutonomousRuns;
exports.getAutonomousRunStats = getAutonomousRunStats;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_client_1 = require("./dynamodb-client");
const AUTONOMOUS_RUNS_TABLE = process.env.AUTONOMOUS_RUNS_TABLE || 'spending-insights-autonomous-runs';
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
/**
 * Get recent autonomous runs for monitoring
 */
async function getRecentAutonomousRuns(runType, limit = 10) {
    const client = dynamodb_client_1.docClient;
    if (runType) {
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: AUTONOMOUS_RUNS_TABLE,
            KeyConditionExpression: 'runType = :runType',
            ExpressionAttributeValues: {
                ':runType': runType
            },
            ScanIndexForward: false, // Sort descending by timestamp
            Limit: limit
        });
        const result = await client.send(command);
        return (result.Items || []);
    }
    else {
        // Get all recent runs across all types (would need a different query strategy in production)
        // For now, just get weekly-insights runs
        return getRecentAutonomousRuns('weekly-insights', limit);
    }
}
/**
 * Get autonomous run statistics for dashboard
 */
async function getAutonomousRunStats(runType, days = 7) {
    const client = dynamodb_client_1.docClient;
    // Calculate date threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - days);
    const thresholdTimestamp = thresholdDate.toISOString();
    const command = new lib_dynamodb_1.QueryCommand({
        TableName: AUTONOMOUS_RUNS_TABLE,
        KeyConditionExpression: 'runType = :runType AND runTimestamp >= :threshold',
        ExpressionAttributeValues: {
            ':runType': runType,
            ':threshold': thresholdTimestamp
        },
        ScanIndexForward: false
    });
    const result = await client.send(command);
    const runs = (result.Items || []);
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
