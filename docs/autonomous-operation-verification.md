# Autonomous Operation Verification Guide

This document provides clear instructions for judges to verify the autonomous capabilities of the Spending Insights AI Agent.

## Overview

The system demonstrates true autonomous operation through:
1. **EventBridge Scheduler** - Triggers weekly insights generation every Sunday at 6 AM Sofia time
2. **Autonomous Run Tracking** - Records all autonomous operations with detailed metrics
3. **Self-Healing** - Continues processing other users even if individual operations fail
4. **Monitoring Dashboard** - CloudWatch dashboard shows system health and performance

## Verification Steps

### 1. EventBridge Scheduler Configuration

**Location**: AWS Console → EventBridge → Schedules

**Schedule Name**: `spending-insights-weekly-generation`

**Expected Configuration**:
- **Schedule Expression**: `cron(0 6 ? * SUN *)`
- **Timezone**: `Europe/Sofia`
- **State**: `ENABLED`
- **Target**: Lambda function `spending-insights-weekly-generator`

**Verification Command**:
```bash
aws events describe-rule --name spending-insights-weekly-generation --region us-east-1
```

### 2. Autonomous Run Tracking

**Database Table**: `spending-insights-autonomous-runs`

**Sample Query** (via AWS Console → DynamoDB):
```
Partition Key: runType = "weekly-insights"
Sort Key: runTimestamp (descending)
```

**Expected Data Structure**:
```json
{
  "runType": "weekly-insights",
  "runTimestamp": "2024-01-14T06:00:00.000Z",
  "status": "completed",
  "duration": 15420,
  "usersProcessed": 3,
  "insightsGenerated": 3,
  "recommendationsCreated": 12,
  "metadata": {
    "source": "autonomous-scheduler",
    "scheduledTime": "2024-01-14T06:00:00.000Z"
  }
}
```

### 3. API Endpoints for Verification

**Get Latest Autonomous Run**:
```bash
curl -X GET "https://[API-GATEWAY-URL]/autonomous-runs/latest?runType=weekly-insights"
```

**Expected Response**:
```json
{
  "runType": "weekly-insights",
  "status": "completed",
  "timestamp": "2024-01-14T06:00:00.000Z",
  "duration": 15420,
  "usersProcessed": 3,
  "insightsGenerated": 3,
  "recommendationsCreated": 12,
  "lastRunDisplay": "Last autonomous run: ✓ 3 insights • 15.4s • 2h ago"
}
```

**Get Autonomous Run Statistics**:
```bash
curl -X GET "https://[API-GATEWAY-URL]/autonomous-runs/stats?runType=weekly-insights&days=7"
```

### 4. CloudWatch Monitoring

**Dashboard Name**: `SpendingInsights-Monitoring`

**Key Metrics to Verify**:
- Lambda function invocations and errors
- API Gateway 4xx/5xx error rates
- DynamoDB throttle events
- X-Ray traces for API handler

**CloudWatch Logs Groups**:
- `/aws/lambda/spending-insights-weekly-generator`
- `/aws/lambda/spending-insights-api-handler`

### 5. Manual Testing (If Schedule Not Yet Triggered)

**Test Autonomous Operation**:
```bash
# Run the test script
npm run test:autonomous

# Or manually invoke the Lambda
aws lambda invoke \
  --function-name spending-insights-weekly-generator \
  --payload '{"source":"autonomous-scheduler","runType":"weekly-insights","timestamp":"2024-01-14T06:00:00.000Z"}' \
  --region us-east-1 \
  response.json
```

**Expected Autonomous Behavior**:
1. Lambda processes multiple users (demo-user-1, demo-user-2, demo-user-3)
2. Generates insights for each user independently
3. Records run metrics in autonomous-runs table
4. Continues processing even if individual users fail
5. Returns summary of total users processed and insights generated

## Autonomy Verification Checklist

- [ ] EventBridge Scheduler exists and is enabled
- [ ] Schedule expression is correct (Sunday 6 AM Sofia time)
- [ ] Target Lambda function is properly configured
- [ ] Autonomous runs table contains execution records
- [ ] API endpoints return autonomous run data
- [ ] CloudWatch dashboard shows system metrics
- [ ] Manual test demonstrates multi-user processing
- [ ] System handles individual user failures gracefully
- [ ] Run tracking includes all required metrics

## Key Autonomy Features Demonstrated

### 1. **Zero Human Intervention**
- Scheduler triggers Lambda automatically
- Lambda processes all users without manual input
- Failures are logged but don't stop processing
- Results are stored automatically

### 2. **Self-Monitoring**
- Every run is tracked with detailed metrics
- Success/failure rates are calculated
- Performance metrics are recorded
- Error messages are captured for debugging

### 3. **Scalable Processing**
- Processes multiple users in batch
- Handles individual user failures gracefully
- Continues processing remaining users
- Provides aggregate statistics

### 4. **Transparent Operation**
- All operations are logged in CloudWatch
- Run history is queryable via API
- UI can display "last autonomous run" status
- Judges can verify operation through multiple channels

## Backup Verification Methods

If the scheduled run hasn't occurred yet:

1. **Manual Trigger**: Use the test script to simulate autonomous operation
2. **CloudWatch Events**: Check EventBridge rule configuration
3. **Lambda Logs**: Verify function can handle autonomous payloads
4. **Database Records**: Confirm tracking table structure and data

## Expected Demo Flow

1. Show EventBridge Scheduler configuration in AWS Console
2. Display autonomous runs table with historical data
3. Call API endpoint to get latest run status
4. Show CloudWatch dashboard with system metrics
5. Demonstrate "Last autonomous run" badge in UI
6. Explain how system processes multiple users automatically

This comprehensive verification approach ensures judges can confirm true autonomous operation regardless of timing constraints.