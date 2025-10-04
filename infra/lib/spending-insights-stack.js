"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpendingInsightsStack = void 0;
const cdk = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const s3 = require("aws-cdk-lib/aws-s3");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const path = require("path");
class SpendingInsightsStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.SpendingInsightsStack = SpendingInsightsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BlbmRpbmctaW5zaWdodHMtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzcGVuZGluZy1pbnNpZ2h0cy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMscURBQXFEO0FBQ3JELHlDQUF5QztBQUN6QyxpREFBaUQ7QUFDakQsMkNBQTJDO0FBQzNDLHlEQUF5RDtBQUN6RCw2QkFBNkI7QUFFN0IsTUFBYSxxQkFBc0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNsRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLCtDQUErQztRQUMvQyxNQUFNLFVBQVUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ25FLFVBQVUsRUFBRSwwQkFBMEIsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ25FLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDeEMsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixTQUFTLEVBQUUsS0FBSztZQUNoQixVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsa0JBQWtCO1FBRWxCLHNCQUFzQjtRQUN0QixNQUFNLGlCQUFpQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDdEUsU0FBUyxFQUFFLGlDQUFpQztZQUM1QyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNyRSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFB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QUMsSUFBSSxFQUFFLCtCQUErQixFQUFFO1lBQ3ZELEtBQUssRUFBRSwwQkFBMEIsQ0FBQyxXQUFXO1lBQzdDLFdBQVcsRUFBRSwyQ0FBMkM7U0FDekQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNqRCxLQUFLLEVBQUUsb0JBQW9CLENBQUMsV0FBVztZQUN2QyxXQUFXLEVBQUUsK0NBQStDO1NBQzdELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDN0MsS0FBSyxFQUFFLGdCQUFnQixDQUFDLFdBQVc7WUFDbkMsV0FBVyxFQUFFLGlDQUFpQztTQUMvQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE3T0Qsc0RBNk9DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBjbGFzcyBTcGVuZGluZ0luc2lnaHRzU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBTMyBCdWNrZXQgZm9yIENTViB1cGxvYWRzIGFuZCBwcm9jZXNzZWQgZGF0YVxuICAgIGNvbnN0IGRhdGFCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTcGVuZGluZ0luc2lnaHRzRGF0YUJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBzcGVuZGluZy1pbnNpZ2h0cy1kYXRhLSR7dGhpcy5hY2NvdW50fS0ke3RoaXMucmVnaW9ufWAsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICB2ZXJzaW9uZWQ6IGZhbHNlLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGVzXG4gICAgXG4gICAgLy8gVXNlciBQcm9maWxlcyBUYWJsZVxuICAgIGNvbnN0IHVzZXJQcm9maWxlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVc2VyUHJvZmlsZXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ3NwZW5kaW5nLWluc2lnaHRzLXVzZXItcHJvZmlsZXMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAncHJvZmlsZVR5cGUnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBUcmFuc2FjdGlvbnMgVGFibGVcbiAgICBjb25zdCB0cmFuc2FjdGlvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVHJhbnNhY3Rpb25zVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdzcGVuZGluZy1pbnNpZ2h0cy10cmFuc2FjdGlvbnMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAndHJhbnNhY3Rpb25LZXknLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LCAvLyBEVCN5eXl5LW1tLWRkI1RYI3R4SWRcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3Igd2Vla2x5IHF1ZXJpZXNcbiAgICB0cmFuc2FjdGlvbnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICd1c2VyV2Vla0lkeCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJXZWVrS2V5JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSwgLy8gVVNFUiN1c2VySWQjVyNpc29XZWVrXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjYXRlZ29yeScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBXZWVrbHkgSW5zaWdodHMgVGFibGVcbiAgICBjb25zdCB3ZWVrbHlJbnNpZ2h0c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdXZWVrbHlJbnNpZ2h0c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnc3BlbmRpbmctaW5zaWdodHMtd2Vla2x5LWluc2lnaHRzJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3dlZWtLZXknLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LCAvLyBXI2lzb1dlZWtcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQWdlbnQgTWVtb3J5IFRhYmxlXG4gICAgY29uc3QgYWdlbnRNZW1vcnlUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQWdlbnRNZW1vcnlUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ3NwZW5kaW5nLWluc2lnaHRzLWFnZW50LW1lbW9yeScsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdtZW1vcnlTY29wZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sIC8vIFNDT1BFI3Njb3BlXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLCAvLyBGb3Igc2hvcnQtdGVybSBtZW1vcnkgaXRlbXNcbiAgICB9KTtcblxuICAgIC8vIElBTSBSb2xlIGZvciBMYW1iZGEgZnVuY3Rpb25zIHdpdGggbGVhc3QgcHJpdmlsZWdlXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnU3BlbmRpbmdJbnNpZ2h0c0xhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBzcGVjaWZpYyBwZXJtaXNzaW9ucyB0byBMYW1iZGEgcm9sZVxuICAgIGRhdGFCdWNrZXQuZ3JhbnRSZWFkV3JpdGUobGFtYmRhUm9sZSk7XG4gICAgdXNlclByb2ZpbGVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuICAgIHRyYW5zYWN0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFSb2xlKTtcbiAgICB3ZWVrbHlJbnNpZ2h0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFSb2xlKTtcbiAgICBhZ2VudE1lbW9yeVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFSb2xlKTtcblxuICAgIC8vIEdyYW50IEJlZHJvY2sgcGVybWlzc2lvbnNcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjBgLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsL2FudGhyb3BpYy5jbGF1ZGUtMy01LXNvbm5ldC0yMDI0MTAyMi12MjowYCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC9hbWF6b24ubm92YS1saXRlLXYxOjBgLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi5ub3ZhLXByby12MTowYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gRW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciBMYW1iZGEgZnVuY3Rpb25zXG4gICAgY29uc3QgbGFtYmRhRW52aXJvbm1lbnQgPSB7XG4gICAgICBVU0VSX1BST0ZJTEVTX1RBQkxFOiB1c2VyUHJvZmlsZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBUUkFOU0FDVElPTlNfVEFCTEU6IHRyYW5zYWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIFdFRUtMWV9JTlNJR0hUU19UQUJMRTogd2Vla2x5SW5zaWdodHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBBR0VOVF9NRU1PUllfVEFCTEU6IGFnZW50TWVtb3J5VGFibGUudGFibGVOYW1lLFxuICAgICAgREFUQV9CVUNLRVQ6IGRhdGFCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIE1PREVMX01PREU6ICdtb2NrJywgLy8gU2V0IHRvICdiZWRyb2NrJyB3aGVuIHJlYWR5IGZvciByZWFsIEFJIGNhbGxzXG4gICAgICBBV1NfTk9ERUpTX0NPTk5FQ1RJT05fUkVVU0VfRU5BQkxFRDogJzEnXG4gICAgfTtcblxuICAgIC8vIExhbWJkYSBGdW5jdGlvbnMgd2l0aCBhY3R1YWwgY29kZVxuICAgIFxuICAgIC8vIFRyYW5zYWN0aW9uIFByb2Nlc3NvciBMYW1iZGFcbiAgICBjb25zdCB0cmFuc2FjdGlvblByb2Nlc3NvckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1RyYW5zYWN0aW9uUHJvY2Vzc29yTGFtYmRhJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAnc3BlbmRpbmctaW5zaWdodHMtdHJhbnNhY3Rpb24tcHJvY2Vzc29yJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9zcmMvbGFtYmRhL3RyYW5zYWN0aW9uLXByb2Nlc3NvcicpKSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBlbnZpcm9ubWVudDogbGFtYmRhRW52aXJvbm1lbnQsXG4gICAgfSk7XG5cbiAgICAvLyBXZWVrbHkgSW5zaWdodHMgR2VuZXJhdG9yIExhbWJkYVxuICAgIGNvbnN0IHdlZWtseUluc2lnaHRzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnV2Vla2x5SW5zaWdodHNMYW1iZGEnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdzcGVuZGluZy1pbnNpZ2h0cy13ZWVrbHktZ2VuZXJhdG9yJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9zcmMvbGFtYmRhL3dlZWtseS1pbnNpZ2h0cy1nZW5lcmF0b3InKSksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgZW52aXJvbm1lbnQ6IGxhbWJkYUVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEhhbmRsZXIgTGFtYmRhXG4gICAgY29uc3QgYXBpSGFuZGxlckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaUhhbmRsZXJMYW1iZGEnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdzcGVuZGluZy1pbnNpZ2h0cy1hcGktaGFuZGxlcicsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vc3JjL2xhbWJkYS9hcGktaGFuZGxlcicpKSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygyNSksIC8vIExlYXZlIGJ1ZmZlciBmb3IgQVBJIEdhdGV3YXlcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiBsYW1iZGFFbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnU3BlbmRpbmdJbnNpZ2h0c0FwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnU3BlbmRpbmcgSW5zaWdodHMgQVBJJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIGZvciB0aGUgU3BlbmRpbmcgSW5zaWdodHMgQUkgQWdlbnQnLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdYLUFtei1EYXRlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1BcGktS2V5JywgJ1gtQW16LVNlY3VyaXR5LVRva2VuJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgTGFtYmRhIEludGVncmF0aW9uXG4gICAgY29uc3QgYXBpSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlIYW5kbGVyTGFtYmRhLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBSb3V0ZXNcbiAgICBcbiAgICAvLyBIZWFsdGggZW5kcG9pbnRzXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBhcGlJbnRlZ3JhdGlvbik7XG4gICAgXG4gICAgY29uc3QgcmVhZGluZXNzUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgncmVhZGluZXNzJyk7XG4gICAgcmVhZGluZXNzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBhcGlJbnRlZ3JhdGlvbik7XG5cbiAgICAvLyBVc2VyIG1hbmFnZW1lbnRcbiAgICBjb25zdCB1c2Vyc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3VzZXJzJyk7XG4gICAgdXNlcnNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBhcGlJbnRlZ3JhdGlvbik7IC8vIENyZWF0ZSB1c2VyXG4gICAgXG4gICAgY29uc3QgdXNlclJlc291cmNlID0gdXNlcnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3VzZXJJZH0nKTtcbiAgICB1c2VyUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBhcGlJbnRlZ3JhdGlvbik7IC8vIEdldCB1c2VyIHByb2ZpbGVcblxuICAgIC8vIFRyYW5zYWN0aW9uIG1hbmFnZW1lbnRcbiAgICBjb25zdCB0cmFuc2FjdGlvbnNSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCd0cmFuc2FjdGlvbnMnKTtcbiAgICBjb25zdCB1cGxvYWRSZXNvdXJjZSA9IHRyYW5zYWN0aW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCd1cGxvYWQnKTtcbiAgICB1cGxvYWRSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBhcGlJbnRlZ3JhdGlvbik7IC8vIENTViB1cGxvYWRcblxuICAgIGNvbnN0IHVzZXJUcmFuc2FjdGlvbnNSZXNvdXJjZSA9IHVzZXJSZXNvdXJjZS5hZGRSZXNvdXJjZSgndHJhbnNhY3Rpb25zJyk7XG4gICAgdXNlclRyYW5zYWN0aW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgYXBpSW50ZWdyYXRpb24pOyAvLyBHZXQgdXNlciB0cmFuc2FjdGlvbnNcblxuICAgIC8vIEluc2lnaHRzXG4gICAgY29uc3QgdXNlckluc2lnaHRzUmVzb3VyY2UgPSB1c2VyUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2luc2lnaHRzJyk7XG4gICAgdXNlckluc2lnaHRzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBhcGlJbnRlZ3JhdGlvbik7IC8vIEdldCBpbnNpZ2h0c1xuICAgIFxuICAgIGNvbnN0IGdlbmVyYXRlSW5zaWdodHNSZXNvdXJjZSA9IHVzZXJJbnNpZ2h0c1Jlc291cmNlLmFkZFJlc291cmNlKCdnZW5lcmF0ZScpO1xuICAgIGdlbmVyYXRlSW5zaWdodHNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBhcGlJbnRlZ3JhdGlvbik7IC8vIEdlbmVyYXRlIGluc2lnaHRzXG5cbiAgICAvLyBHcmFudCBBUEkgR2F0ZXdheSBwZXJtaXNzaW9uIHRvIGludm9rZSBMYW1iZGFcbiAgICBhcGlIYW5kbGVyTGFtYmRhLmFkZFBlcm1pc3Npb24oJ0FwaUdhdGV3YXlJbnZva2UnLCB7XG4gICAgICBwcmluY2lwYWw6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYXBpZ2F0ZXdheS5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IGFwaS5hcm5Gb3JFeGVjdXRlQXBpKCksXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlVcmwnLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgZW5kcG9pbnQgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXRhQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBkYXRhQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgQ1NWIHVwbG9hZHMgYW5kIHByb2Nlc3NlZCBkYXRhJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUHJvZmlsZXNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdXNlclByb2ZpbGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiB0YWJsZSBmb3IgdXNlciBwcm9maWxlcycsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVHJhbnNhY3Rpb25zVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRyYW5zYWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgZm9yIHRyYW5zYWN0aW9ucycsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2Vla2x5SW5zaWdodHNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogd2Vla2x5SW5zaWdodHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlIGZvciB3ZWVrbHkgaW5zaWdodHMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50TWVtb3J5VGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IGFnZW50TWVtb3J5VGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiB0YWJsZSBmb3IgYWdlbnQgbWVtb3J5JyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdUcmFuc2FjdGlvblByb2Nlc3NvckxhbWJkYUFybicsIHtcbiAgICAgIHZhbHVlOiB0cmFuc2FjdGlvblByb2Nlc3NvckxhbWJkYS5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHJhbnNhY3Rpb24gUHJvY2Vzc29yIExhbWJkYSBmdW5jdGlvbiBBUk4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlZWtseUluc2lnaHRzTGFtYmRhQXJuJywge1xuICAgICAgdmFsdWU6IHdlZWtseUluc2lnaHRzTGFtYmRhLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWVrbHkgSW5zaWdodHMgR2VuZXJhdG9yIExhbWJkYSBmdW5jdGlvbiBBUk4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUhhbmRsZXJMYW1iZGFBcm4nLCB7XG4gICAgICB2YWx1ZTogYXBpSGFuZGxlckxhbWJkYS5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEhhbmRsZXIgTGFtYmRhIGZ1bmN0aW9uIEFSTicsXG4gICAgfSk7XG4gIH1cbn0iXX0=