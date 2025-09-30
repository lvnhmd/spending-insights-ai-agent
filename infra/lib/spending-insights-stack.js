"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpendingInsightsStack = void 0;
const cdk = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const s3 = require("aws-cdk-lib/aws-s3");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
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
            sortKey: { name: 'transactionKey', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Add GSI for weekly queries
        transactionsTable.addGlobalSecondaryIndex({
            indexName: 'userWeekIdx',
            partitionKey: { name: 'userWeekKey', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'category', type: dynamodb.AttributeType.STRING },
        });
        // Weekly Insights Table
        const weeklyInsightsTable = new dynamodb.Table(this, 'WeeklyInsightsTable', {
            tableName: 'spending-insights-weekly-insights',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'weekKey', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Agent Memory Table
        const agentMemoryTable = new dynamodb.Table(this, 'AgentMemoryTable', {
            tableName: 'spending-insights-agent-memory',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'memoryScope', type: dynamodb.AttributeType.STRING },
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
        // Lambda Function Skeletons
        // Transaction Processor Lambda
        const transactionProcessorLambda = new lambda.Function(this, 'TransactionProcessorLambda', {
            functionName: 'spending-insights-transaction-processor',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Transaction Processor Lambda - Event:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Transaction processor placeholder' })
          };
        };
      `),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
        });
        // Weekly Insights Generator Lambda
        const weeklyInsightsLambda = new lambda.Function(this, 'WeeklyInsightsLambda', {
            functionName: 'spending-insights-weekly-generator',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Weekly Insights Generator Lambda - Event:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Weekly insights generator placeholder' })
          };
        };
      `),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
        });
        // API Handler Lambda
        const apiHandlerLambda = new lambda.Function(this, 'ApiHandlerLambda', {
            functionName: 'spending-insights-api-handler',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('API Handler Lambda - Event:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ message: 'API handler placeholder' })
          };
        };
      `),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(25),
            memorySize: 512,
        });
        // Outputs
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
    }
}
exports.SpendingInsightsStack = SpendingInsightsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BlbmRpbmctaW5zaWdodHMtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzcGVuZGluZy1pbnNpZ2h0cy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMscURBQXFEO0FBQ3JELHlDQUF5QztBQUN6QyxpREFBaUQ7QUFDakQsMkNBQTJDO0FBRTNDLE1BQWEscUJBQXNCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwrQ0FBK0M7UUFDL0MsTUFBTSxVQUFVLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSw0QkFBNEIsRUFBRTtZQUNuRSxVQUFVLEVBQUUsMEJBQTBCLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNuRSxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsU0FBUyxFQUFFLEtBQUs7WUFDaEIsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO1NBQzNDLENBQUMsQ0FBQztRQUVILGtCQUFrQjtRQUVsQixzQkFBc0I7UUFDdEIsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3RFLFNBQVMsRUFBRSxpQ0FBaUM7WUFDNUMsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDckUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDckUsV0FB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dUJBQXVCLEVBQUU7WUFDL0MsS0FBSyxFQUFFLGlCQUFpQixDQUFDLFNBQVM7WUFDbEMsV0FBVyxFQUFFLGlDQUFpQztTQUMvQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ2pELEtBQUssRUFBRSxtQkFBbUIsQ0FBQyxTQUFTO1lBQ3BDLFdBQVcsRUFBRSxvQ0FBb0M7U0FDbEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUM5QyxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsU0FBUztZQUNqQyxXQUFXLEVBQUUsaUNBQWlDO1NBQy9DLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxMRCxzREFrTEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcblxuZXhwb3J0IGNsYXNzIFNwZW5kaW5nSW5zaWdodHNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFMzIEJ1Y2tldCBmb3IgQ1NWIHVwbG9hZHMgYW5kIHByb2Nlc3NlZCBkYXRhXG4gICAgY29uc3QgZGF0YUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1NwZW5kaW5nSW5zaWdodHNEYXRhQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHNwZW5kaW5nLWluc2lnaHRzLWRhdGEtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgICBcbiAgICAvLyBVc2VyIFByb2ZpbGVzIFRhYmxlXG4gICAgY29uc3QgdXNlclByb2ZpbGVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VzZXJQcm9maWxlc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnc3BlbmRpbmctaW5zaWdodHMtdXNlci1wcm9maWxlcycsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdwcm9maWxlVHlwZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIFRyYW5zYWN0aW9ucyBUYWJsZVxuICAgIGNvbnN0IHRyYW5zYWN0aW9uc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdUcmFuc2FjdGlvbnNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ3NwZW5kaW5nLWluc2lnaHRzLXRyYW5zYWN0aW9ucycsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0cmFuc2FjdGlvbktleScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sIC8vIERUI3l5eXktbW0tZGQjVFgjdHhJZFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciB3ZWVrbHkgcXVlcmllc1xuICAgIHRyYW5zYWN0aW9uc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ3VzZXJXZWVrSWR4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcldlZWtLZXknLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LCAvLyBVU0VSI3VzZXJJZCNXI2lzb1dlZWtcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2NhdGVnb3J5JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIC8vIFdlZWtseSBJbnNpZ2h0cyBUYWJsZVxuICAgIGNvbnN0IHdlZWtseUluc2lnaHRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1dlZWtseUluc2lnaHRzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdzcGVuZGluZy1pbnNpZ2h0cy13ZWVrbHktaW5zaWdodHMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnd2Vla0tleScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sIC8vIFcjaXNvV2Vla1xuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBBZ2VudCBNZW1vcnkgVGFibGVcbiAgICBjb25zdCBhZ2VudE1lbW9yeVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBZ2VudE1lbW9yeVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnc3BlbmRpbmctaW5zaWdodHMtYWdlbnQtbWVtb3J5JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ21lbW9yeVNjb3BlJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSwgLy8gU0NPUEUjc2NvcGVcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsIC8vIEZvciBzaG9ydC10ZXJtIG1lbW9yeSBpdGVtc1xuICAgIH0pO1xuXG4gICAgLy8gSUFNIFJvbGUgZm9yIExhbWJkYSBmdW5jdGlvbnMgd2l0aCBsZWFzdCBwcml2aWxlZ2VcbiAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdTcGVuZGluZ0luc2lnaHRzTGFtYmRhUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHNwZWNpZmljIHBlcm1pc3Npb25zIHRvIExhbWJkYSByb2xlXG4gICAgZGF0YUJ1Y2tldC5ncmFudFJlYWRXcml0ZShsYW1iZGFSb2xlKTtcbiAgICB1c2VyUHJvZmlsZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG4gICAgdHJhbnNhY3Rpb25zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuICAgIHdlZWtseUluc2lnaHRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuICAgIGFnZW50TWVtb3J5VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuXG4gICAgLy8gR3JhbnQgQmVkcm9jayBwZXJtaXNzaW9uc1xuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtaGFpa3UtMjAyNDAzMDctdjE6MGAsXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0zLTUtc29ubmV0LTIwMjQxMDIyLXYyOjBgLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi5ub3ZhLWxpdGUtdjE6MGAsXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLm5vdmEtcHJvLXYxOjBgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb24gU2tlbGV0b25zXG4gICAgXG4gICAgLy8gVHJhbnNhY3Rpb24gUHJvY2Vzc29yIExhbWJkYVxuICAgIGNvbnN0IHRyYW5zYWN0aW9uUHJvY2Vzc29yTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVHJhbnNhY3Rpb25Qcm9jZXNzb3JMYW1iZGEnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdzcGVuZGluZy1pbnNpZ2h0cy10cmFuc2FjdGlvbi1wcm9jZXNzb3InLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1RyYW5zYWN0aW9uIFByb2Nlc3NvciBMYW1iZGEgLSBFdmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IG1lc3NhZ2U6ICdUcmFuc2FjdGlvbiBwcm9jZXNzb3IgcGxhY2Vob2xkZXInIH0pXG4gICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KTtcblxuICAgIC8vIFdlZWtseSBJbnNpZ2h0cyBHZW5lcmF0b3IgTGFtYmRhXG4gICAgY29uc3Qgd2Vla2x5SW5zaWdodHNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdXZWVrbHlJbnNpZ2h0c0xhbWJkYScsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3NwZW5kaW5nLWluc2lnaHRzLXdlZWtseS1nZW5lcmF0b3InLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1dlZWtseSBJbnNpZ2h0cyBHZW5lcmF0b3IgTGFtYmRhIC0gRXZlbnQ6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiAnV2Vla2x5IGluc2lnaHRzIGdlbmVyYXRvciBwbGFjZWhvbGRlcicgfSlcbiAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEhhbmRsZXIgTGFtYmRhXG4gICAgY29uc3QgYXBpSGFuZGxlckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaUhhbmRsZXJMYW1iZGEnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdzcGVuZGluZy1pbnNpZ2h0cy1hcGktaGFuZGxlcicsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnQVBJIEhhbmRsZXIgTGFtYmRhIC0gRXZlbnQ6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgbWVzc2FnZTogJ0FQSSBoYW5kbGVyIHBsYWNlaG9sZGVyJyB9KVxuICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygyNSksIC8vIExlYXZlIGJ1ZmZlciBmb3IgQVBJIEdhdGV3YXlcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGF0YUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogZGF0YUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBidWNrZXQgZm9yIENTViB1cGxvYWRzIGFuZCBwcm9jZXNzZWQgZGF0YScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclByb2ZpbGVzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHVzZXJQcm9maWxlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgZm9yIHVzZXIgcHJvZmlsZXMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RyYW5zYWN0aW9uc1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0cmFuc2FjdGlvbnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlIGZvciB0cmFuc2FjdGlvbnMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlZWtseUluc2lnaHRzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHdlZWtseUluc2lnaHRzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiB0YWJsZSBmb3Igd2Vla2x5IGluc2lnaHRzJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudE1lbW9yeVRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBhZ2VudE1lbW9yeVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgZm9yIGFnZW50IG1lbW9yeScsXG4gICAgfSk7XG4gIH1cbn0iXX0=