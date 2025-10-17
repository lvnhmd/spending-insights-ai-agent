/**
 * Test Autonomous Operation Script
 * Tests the EventBridge Scheduler and autonomous run tracking
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SchedulerClient, GetScheduleCommand } from '@aws-sdk/client-scheduler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const lambdaClient = new LambdaClient({ region: AWS_REGION });
const schedulerClient = new SchedulerClient({ region: AWS_REGION });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

async function testAutonomousOperation() {
  console.log('🚀 Testing Autonomous Operation...\n');

  try {
    // 1. Check if EventBridge Scheduler exists
    console.log('1. Checking EventBridge Scheduler...');
    await checkScheduler();

    // 2. Test manual invocation of weekly insights generator
    console.log('\n2. Testing manual invocation of weekly insights generator...');
    await testWeeklyInsightsGenerator();

    // 3. Test autonomous run tracking
    console.log('\n3. Testing autonomous run tracking...');
    await testAutonomousRunTracking();

    // 4. Test API endpoints for autonomous runs
    console.log('\n4. Testing API endpoints...');
    await testAPIEndpoints();

    console.log('\n✅ All autonomous operation tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Autonomous operation test failed:', error);
    process.exit(1);
  }
}

async function checkScheduler() {
  try {
    const command = new GetScheduleCommand({
      Name: 'spending-insights-weekly-generation'
    });

    const result = await schedulerClient.send(command);
    
    console.log('   ✅ EventBridge Scheduler found:');
    console.log(`      Name: ${result.Name}`);
    console.log(`      Schedule: ${result.ScheduleExpression}`);
    console.log(`      Timezone: ${result.ScheduleExpressionTimezone}`);
    console.log(`      State: ${result.State}`);
    console.log(`      Target ARN: ${result.Target?.Arn}`);

  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      console.log('   ⚠️  EventBridge Scheduler not found - may need to be deployed');
    } else {
      console.error('   ❌ Error checking scheduler:', error);
      throw error;
    }
  }
}

async function testWeeklyInsightsGenerator() {
  try {
    // Test with autonomous scheduler payload
    const autonomousPayload = {
      source: 'autonomous-scheduler',
      runType: 'weekly-insights',
      timestamp: new Date().toISOString()
    };

    console.log('   Testing autonomous scheduler invocation...');
    const autonomousResult = await invokeLambda('spending-insights-weekly-generator', autonomousPayload);
    console.log('   ✅ Autonomous invocation result:', JSON.stringify(autonomousResult, null, 2));

    // Test with single user payload
    const userPayload = {
      userId: 'demo-user-1',
      forceRegenerate: true
    };

    console.log('   Testing single user invocation...');
    const userResult = await invokeLambda('spending-insights-weekly-generator', userPayload);
    console.log('   ✅ Single user invocation result:', JSON.stringify(userResult, null, 2));

  } catch (error) {
    console.error('   ❌ Error testing weekly insights generator:', error);
    throw error;
  }
}

async function testAutonomousRunTracking() {
  try {
    const tableName = process.env.AUTONOMOUS_RUNS_TABLE || 'spending-insights-autonomous-runs';
    
    console.log(`   Querying autonomous runs table: ${tableName}`);
    
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'runType = :runType',
      ExpressionAttributeValues: {
        ':runType': 'weekly-insights'
      },
      ScanIndexForward: false, // Most recent first
      Limit: 5
    });

    const result = await dynamoClient.send(command);
    
    if (result.Items && result.Items.length > 0) {
      console.log(`   ✅ Found ${result.Items.length} autonomous runs:`);
      result.Items.forEach((item, index) => {
        console.log(`      ${index + 1}. ${item.runTimestamp} - ${item.status} (${item.duration}ms)`);
        if (item.usersProcessed) {
          console.log(`         Users: ${item.usersProcessed}, Insights: ${item.insightsGenerated}`);
        }
      });
    } else {
      console.log('   ⚠️  No autonomous runs found in database');
    }

  } catch (error) {
    console.error('   ❌ Error testing autonomous run tracking:', error);
    throw error;
  }
}

async function testAPIEndpoints() {
  try {
    // Test latest autonomous run endpoint
    console.log('   Testing latest autonomous run API...');
    const latestRunPayload = {
      httpMethod: 'GET',
      path: '/autonomous-runs/latest',
      queryStringParameters: { runType: 'weekly-insights' },
      headers: {},
      body: null
    };

    const latestRunResult = await invokeLambda('spending-insights-api-handler', latestRunPayload);
    console.log('   ✅ Latest run API result:', JSON.stringify(latestRunResult, null, 2));

    // Test autonomous run stats endpoint
    console.log('   Testing autonomous run stats API...');
    const statsPayload = {
      httpMethod: 'GET',
      path: '/autonomous-runs/stats',
      queryStringParameters: { runType: 'weekly-insights', days: '7' },
      headers: {},
      body: null
    };

    const statsResult = await invokeLambda('spending-insights-api-handler', statsPayload);
    console.log('   ✅ Stats API result:', JSON.stringify(statsResult, null, 2));

  } catch (error) {
    console.error('   ❌ Error testing API endpoints:', error);
    throw error;
  }
}

async function invokeLambda(functionName: string, payload: any): Promise<any> {
  const command = new InvokeCommand({
    FunctionName: functionName,
    Payload: JSON.stringify(payload),
    InvocationType: 'RequestResponse'
  });

  const result = await lambdaClient.send(command);
  
  if (result.Payload) {
    const payloadString = new TextDecoder().decode(result.Payload);
    return JSON.parse(payloadString);
  }
  
  return null;
}

// Run the test
if (require.main === module) {
  testAutonomousOperation().catch(console.error);
}

export { testAutonomousOperation };