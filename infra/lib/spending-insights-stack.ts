import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class SpendingInsightsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for CSV uploads and processed data
    const dataBucket = new s3.Bucket(this, 'SpendingInsightsDataBucket', {
      bucketName: `spending-insights-data-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // DynamoDB Tables
    
    // User Profiles Table
    const userProfilesTable = new dynamodb.Table(this, 'UserProfilesTable', {
      tableName: 'spending-insights-user-profiles',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'profileType', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Transactions Table
    const transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      tableName: 'spending-insights-transactions',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'transactionKey', type: dynamodb.AttributeType.STRING }, // DT#yyyy-mm-dd#TX#txId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for weekly queries
    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'userWeekIdx',
      partitionKey: { name: 'userWeekKey', type: dynamodb.AttributeType.STRING }, // USER#userId#W#isoWeek
      sortKey: { name: 'category', type: dynamodb.AttributeType.STRING },
    });

    // Weekly Insights Table
    const weeklyInsightsTable = new dynamodb.Table(this, 'WeeklyInsightsTable', {
      tableName: 'spending-insights-weekly-insights',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'weekKey', type: dynamodb.AttributeType.STRING }, // W#isoWeek
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Agent Memory Table
    const agentMemoryTable = new dynamodb.Table(this, 'AgentMemoryTable', {
      tableName: 'spending-insights-agent-memory',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'memoryScope', type: dynamodb.AttributeType.STRING }, // SCOPE#scope
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl', // For short-term memory items
    });

    // IAM Role for Lambda functions with least privilege
    const lambdaRole = new iam.Role(this, 'SpendingInsightsLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant specific permissions to Lambda role
    dataBucket.grantReadWrite(lambdaRole);
    userProfilesTable.grantReadWriteData(lambdaRole);
    transactionsTable.grantReadWriteData(lambdaRole);
    weeklyInsightsTable.grantReadWriteData(lambdaRole);
    agentMemoryTable.grantReadWriteData(lambdaRole);

    // Grant Bedrock permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-lite-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
      ],
    }));

    // Environment variables for Lambda functions
    const lambdaEnvironment = {
      USER_PROFILES_TABLE: userProfilesTable.tableName,
      TRANSACTIONS_TABLE: transactionsTable.tableName,
      WEEKLY_INSIGHTS_TABLE: weeklyInsightsTable.tableName,
      AGENT_MEMORY_TABLE: agentMemoryTable.tableName,
      DATA_BUCKET: dataBucket.bucketName,
      MODEL_MODE: 'mock', // Set to 'bedrock' when ready for real AI calls
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
    };

    // Lambda Functions with actual code
    
    // Transaction Processor Lambda
    const transactionProcessorLambda = new lambda.Function(this, 'TransactionProcessorLambda', {
      functionName: 'spending-insights-transaction-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../src/lambda/transaction-processor')),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: lambdaEnvironment,
    });

    // Weekly Insights Generator Lambda
    const weeklyInsightsLambda = new lambda.Function(this, 'WeeklyInsightsLambda', {
      functionName: 'spending-insights-weekly-generator',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../src/lambda/weekly-insights-generator')),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: lambdaEnvironment,
    });

    // API Handler Lambda
    const apiHandlerLambda = new lambda.Function(this, 'ApiHandlerLambda', {
      functionName: 'spending-insights-api-handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../src/lambda/api-handler')),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(25), // Leave buffer for API Gateway
      memorySize: 512,
      environment: lambdaEnvironment,
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'SpendingInsightsApi', {
      restApiName: 'Spending Insights API',
      description: 'API for the Spending Insights AI Agent',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // API Gateway Lambda Integration
    const apiIntegration = new apigateway.LambdaIntegration(apiHandlerLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // API Routes
    
    // Health endpoints
    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', apiIntegration);
    
    const readinessResource = api.root.addResource('readiness');
    readinessResource.addMethod('GET', apiIntegration);

    // User management
    const usersResource = api.root.addResource('users');
    usersResource.addMethod('POST', apiIntegration); // Create user
    
    const userResource = usersResource.addResource('{userId}');
    userResource.addMethod('GET', apiIntegration); // Get user profile

    // Transaction management
    const transactionsResource = api.root.addResource('transactions');
    const uploadResource = transactionsResource.addResource('upload');
    uploadResource.addMethod('POST', apiIntegration); // CSV upload

    const userTransactionsResource = userResource.addResource('transactions');
    userTransactionsResource.addMethod('GET', apiIntegration); // Get user transactions

    // Insights
    const userInsightsResource = userResource.addResource('insights');
    userInsightsResource.addMethod('GET', apiIntegration); // Get insights
    
    const generateInsightsResource = userInsightsResource.addResource('generate');
    generateInsightsResource.addMethod('POST', apiIntegration); // Generate insights

    // Grant API Gateway permission to invoke Lambda
    apiHandlerLambda.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: api.arnForExecuteApi(),
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: dataBucket.bucketName,
      description: 'S3 bucket for CSV uploads and processed data',
    });

    new cdk.CfnOutput(this, 'UserProfilesTableName', {
      value: userProfilesTable.tableName,
      description: 'DynamoDB table for user profiles',
    });

    new cdk.CfnOutput(this, 'TransactionsTableName', {
      value: transactionsTable.tableName,
      description: 'DynamoDB table for transactions',
    });

    new cdk.CfnOutput(this, 'WeeklyInsightsTableName', {
      value: weeklyInsightsTable.tableName,
      description: 'DynamoDB table for weekly insights',
    });

    new cdk.CfnOutput(this, 'AgentMemoryTableName', {
      value: agentMemoryTable.tableName,
      description: 'DynamoDB table for agent memory',
    });

    new cdk.CfnOutput(this, 'TransactionProcessorLambdaArn', {
      value: transactionProcessorLambda.functionArn,
      description: 'Transaction Processor Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'WeeklyInsightsLambdaArn', {
      value: weeklyInsightsLambda.functionArn,
      description: 'Weekly Insights Generator Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'ApiHandlerLambdaArn', {
      value: apiHandlerLambda.functionArn,
      description: 'API Handler Lambda function ARN',
    });
  }
}