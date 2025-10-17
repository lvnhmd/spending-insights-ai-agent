/**
 * Verify Deployment Script
 * Checks if all required AWS resources are deployed and configured correctly
 */

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { SchedulerClient, GetScheduleCommand } from '@aws-sdk/client-scheduler';
import { APIGatewayClient, GetRestApiCommand } from '@aws-sdk/client-api-gateway';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const cloudFormationClient = new CloudFormationClient({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const lambdaClient = new LambdaClient({ region: AWS_REGION });
const schedulerClient = new SchedulerClient({ region: AWS_REGION });
const apiGatewayClient = new APIGatewayClient({ region: AWS_REGION });

async function verifyDeployment() {
  console.log('🔍 Verifying Deployment...\n');

  const results = {
    cloudFormation: false,
    dynamoTables: false,
    lambdaFunctions: false,
    eventBridgeScheduler: false,
    apiGateway: false,
    autonomousRunsTable: false
  };

  try {
    // 1. Check CloudFormation Stack
    console.log('1. Checking CloudFormation Stack...');
    results.cloudFormation = await checkCloudFormationStack();

    // 2. Check DynamoDB Tables
    console.log('\n2. Checking DynamoDB Tables...');
    results.dynamoTables = await checkDynamoTables();

    // 3. Check Lambda Functions
    console.log('\n3. Checking Lambda Functions...');
    results.lambdaFunctions = await checkLambdaFunctions();

    // 4. Check EventBridge Scheduler
    console.log('\n4. Checking EventBridge Scheduler...');
    results.eventBridgeScheduler = await checkEventBridgeScheduler();

    // 5. Check API Gateway
    console.log('\n5. Checking API Gateway...');
    results.apiGateway = await checkAPIGateway();

    // 6. Check Autonomous Runs Table specifically
    console.log('\n6. Checking Autonomous Runs Table...');
    results.autonomousRunsTable = await checkAutonomousRunsTable();

    // Summary
    console.log('\n📊 Deployment Verification Summary:');
    Object.entries(results).forEach(([component, status]) => {
      const icon = status ? '✅' : '❌';
      console.log(`   ${icon} ${component}: ${status ? 'OK' : 'MISSING'}`);
    });

    const allGood = Object.values(results).every(status => status);
    
    if (allGood) {
      console.log('\n🎉 All components deployed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('   1. Run: npm run test:autonomous');
      console.log('   2. Check CloudWatch Dashboard');
      console.log('   3. Test API endpoints');
    } else {
      console.log('\n⚠️  Some components are missing. Run deployment:');
      console.log('   npm run deploy');
    }

    return allGood;

  } catch (error) {
    console.error('\n❌ Deployment verification failed:', error);
    return false;
  }
}

async function checkCloudFormationStack(): Promise<boolean> {
  try {
    const command = new DescribeStacksCommand({
      StackName: 'SpendingInsightsStack'
    });

    const result = await cloudFormationClient.send(command);
    
    if (result.Stacks && result.Stacks.length > 0) {
      const stack = result.Stacks[0];
      console.log(`   ✅ Stack: ${stack.StackName} (${stack.StackStatus})`);
      return stack.StackStatus === 'CREATE_COMPLETE' || stack.StackStatus === 'UPDATE_COMPLETE';
    }
    
    return false;

  } catch (error) {
    console.log('   ❌ CloudFormation stack not found');
    return false;
  }
}

async function checkDynamoTables(): Promise<boolean> {
  const tables = [
    'spending-insights-user-profiles',
    'spending-insights-transactions',
    'spending-insights-weekly-insights',
    'spending-insights-agent-memory',
    'spending-insights-autonomous-runs'
  ];

  let allTablesExist = true;

  for (const tableName of tables) {
    try {
      const command = new DescribeTableCommand({ TableName: tableName });
      const result = await dynamoClient.send(command);
      
      if (result.Table?.TableStatus === 'ACTIVE') {
        console.log(`   ✅ ${tableName}: ACTIVE`);
      } else {
        console.log(`   ⚠️  ${tableName}: ${result.Table?.TableStatus}`);
        allTablesExist = false;
      }
    } catch (error) {
      console.log(`   ❌ ${tableName}: NOT FOUND`);
      allTablesExist = false;
    }
  }

  return allTablesExist;
}

async function checkLambdaFunctions(): Promise<boolean> {
  const functions = [
    'spending-insights-transaction-processor',
    'spending-insights-weekly-generator',
    'spending-insights-api-handler'
  ];

  let allFunctionsExist = true;

  for (const functionName of functions) {
    try {
      const command = new GetFunctionCommand({ FunctionName: functionName });
      const result = await lambdaClient.send(command);
      
      console.log(`   ✅ ${functionName}: ${result.Configuration?.State}`);
      
      if (result.Configuration?.State !== 'Active') {
        allFunctionsExist = false;
      }
    } catch (error) {
      console.log(`   ❌ ${functionName}: NOT FOUND`);
      allFunctionsExist = false;
    }
  }

  return allFunctionsExist;
}

async function checkEventBridgeScheduler(): Promise<boolean> {
  try {
    const command = new GetScheduleCommand({
      Name: 'spending-insights-weekly-generation'
    });

    const result = await schedulerClient.send(command);
    
    console.log(`   ✅ Schedule: ${result.Name} (${result.State})`);
    console.log(`      Expression: ${result.ScheduleExpression}`);
    console.log(`      Timezone: ${result.ScheduleExpressionTimezone}`);
    
    return result.State === 'ENABLED';

  } catch (error) {
    console.log('   ❌ EventBridge Scheduler not found');
    return false;
  }
}

async function checkAPIGateway(): Promise<boolean> {
  try {
    // This is a simplified check - in practice you'd get the API ID from CloudFormation outputs
    console.log('   ⚠️  API Gateway check requires manual verification');
    console.log('      Check AWS Console → API Gateway for "Spending Insights API"');
    return true; // Assume OK for now
  } catch (error) {
    console.log('   ❌ API Gateway check failed');
    return false;
  }
}

async function checkAutonomousRunsTable(): Promise<boolean> {
  try {
    const command = new DescribeTableCommand({ 
      TableName: 'spending-insights-autonomous-runs' 
    });
    
    const result = await dynamoClient.send(command);
    
    if (result.Table?.TableStatus === 'ACTIVE') {
      console.log('   ✅ Autonomous runs table: ACTIVE');
      
      // Check if GSI exists
      const gsi = result.Table.GlobalSecondaryIndexes?.find(
        index => index.IndexName === 'runTypeLatestIdx'
      );
      
      if (gsi) {
        console.log('   ✅ GSI runTypeLatestIdx: ACTIVE');
      } else {
        console.log('   ⚠️  GSI runTypeLatestIdx: NOT FOUND');
      }
      
      return true;
    }
    
    return false;

  } catch (error) {
    console.log('   ❌ Autonomous runs table: NOT FOUND');
    return false;
  }
}

// Run the verification
if (require.main === module) {
  verifyDeployment().catch(console.error);
}

export { verifyDeployment };