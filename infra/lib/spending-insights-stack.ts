import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';

interface SpendingInsightsStackProps extends cdk.StackProps {
  domainName?: string; // e.g., 'spending-insights.yourdomain.com'
  hostedZoneId?: string; // Your Route 53 hosted zone ID
}

export class SpendingInsightsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: SpendingInsightsStackProps) {
    super(scope, id, props);

    // S3 Bucket for CSV uploads and processed data
    const dataBucket = new s3.Bucket(this, 'SpendingInsightsDataBucket', {
      bucketName: `spending-insights-data-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // S3 Bucket for hosting the Next.js frontend
    const websiteBucket = new s3.Bucket(this, 'SpendingInsightsWebsite', {
      bucketName: `spending-insights-website-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    });

    // SSL Certificate and Domain Configuration
    let certificate: acm.ICertificate | undefined;
    let hostedZone: route53.IHostedZone | undefined;
    
    if (props?.domainName && props?.hostedZoneId) {
      // Import existing hosted zone
      hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName.split('.').slice(-2).join('.'), // Extract root domain
      });

      // Create SSL certificate
      certificate = new acm.Certificate(this, 'SpendingInsightsCertificate', {
        domainName: props.domainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    // CloudFront Distribution for global CDN
    const distribution = new cloudfront.Distribution(this, 'SpendingInsightsDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing support
        },
      ],
      // Add custom domain if provided
      ...(props?.domainName && certificate ? {
        domainNames: [props.domainName],
        certificate: certificate,
      } : {}),
    });

    // Create DNS record if domain is configured
    if (props?.domainName && hostedZone) {
      new route53.ARecord(this, 'SpendingInsightsAliasRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }

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

    // Autonomous Run Tracking Table
    const autonomousRunsTable = new dynamodb.Table(this, 'AutonomousRunsTable', {
      tableName: 'spending-insights-autonomous-runs',
      partitionKey: { name: 'runType', type: dynamodb.AttributeType.STRING }, // 'weekly-insights'
      sortKey: { name: 'runTimestamp', type: dynamodb.AttributeType.STRING }, // ISO timestamp
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for latest run queries
    autonomousRunsTable.addGlobalSecondaryIndex({
      indexName: 'runTypeLatestIdx',
      partitionKey: { name: 'runType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'runTimestamp', type: dynamodb.AttributeType.STRING },
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
    autonomousRunsTable.grantReadWriteData(lambdaRole);

    // Grant Bedrock permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:ApplyGuardrail',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-lite-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
        `arn:aws:bedrock:${this.region}:${this.account}:guardrail/*`,
      ],
    }));

    // Grant Lambda invoke permissions (for API handler to trigger insights generator)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction',
      ],
      resources: [
        `arn:aws:lambda:${this.region}:${this.account}:function:spending-insights-*`,
      ],
    }));

    // Simplified Bedrock Guardrails Configuration
    const bedrockGuardrail = new bedrock.CfnGuardrail(this, 'SpendingInsightsGuardrail', {
      name: 'SpendingInsightsGuardrails',
      description: 'Basic PII protection for spending insights AI agent',
      blockedInputMessaging: 'I cannot process this request as it contains sensitive information.',
      blockedOutputsMessaging: 'I cannot provide this response as it may contain sensitive information.',

      // Sensitive Information Policy Configuration
      sensitiveInformationPolicyConfig: {
        piiEntitiesConfig: [
          { type: 'CREDIT_DEBIT_CARD_NUMBER', action: 'BLOCK' },
          { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'BLOCK' },
          { type: 'EMAIL', action: 'ANONYMIZE' },
          { type: 'PHONE', action: 'ANONYMIZE' },
        ],
      },
    });

    // Create a version of the guardrail
    const guardrailVersion = new bedrock.CfnGuardrailVersion(this, 'SpendingInsightsGuardrailVersion', {
      guardrailIdentifier: bedrockGuardrail.attrGuardrailId,
      description: 'Version 1.0 of the Spending Insights Guardrails',
    });

    // Environment variables for Lambda functions
    const lambdaEnvironment = {
      USER_PROFILES_TABLE: userProfilesTable.tableName,
      TRANSACTIONS_TABLE: transactionsTable.tableName,
      WEEKLY_INSIGHTS_TABLE: weeklyInsightsTable.tableName,
      AGENT_MEMORY_TABLE: agentMemoryTable.tableName,
      AUTONOMOUS_RUNS_TABLE: autonomousRunsTable.tableName,
      DATA_BUCKET: dataBucket.bucketName,
      MODEL_MODE: 'mock', // Set to 'bedrock' when ready for real AI calls
      BEDROCK_GUARDRAIL_ID: bedrockGuardrail.attrGuardrailId,
      BEDROCK_GUARDRAIL_VERSION: guardrailVersion.attrVersion,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      // External API Feature Flags
      USE_CACHED_APIS: 'true',
      MODEL_TIER: 'haiku',
      ENABLE_PLAID: 'false',
      ENABLE_ALPHA_VANTAGE: 'true',
      ENABLE_FRED: 'false',
      CACHE_DIRECTORY: '/tmp/cache',
      API_TIMEOUT_MS: '5000',
      MAX_RETRIES: '3',
      DEMO_MODE: 'true'
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
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
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

    // EventBridge Scheduler for autonomous weekly insights generation

    // IAM Role for EventBridge Scheduler
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // Grant scheduler permission to invoke the weekly insights Lambda
    weeklyInsightsLambda.grantInvoke(schedulerRole);

    // Create the insights schedule (daily at 20:45 Sofia time / 18:45 UK time)
    const insightsSchedule = new scheduler.CfnSchedule(this, 'InsightsSchedule', {
      name: 'spending-insights-daily-generation',
      description: 'Autonomous daily insights generation at 20:45 Sofia time (18:45 UK time)',
      scheduleExpression: 'cron(45 20 * * ? *)', // 20:45 Sofia time daily
      scheduleExpressionTimezone: 'Europe/Sofia',
      flexibleTimeWindow: {
        mode: 'OFF'
      },
      target: {
        arn: weeklyInsightsLambda.functionArn,
        roleArn: schedulerRole.roleArn,
        input: JSON.stringify({
          source: 'autonomous-scheduler',
          runType: 'daily-insights',
          timestamp: new Date().toISOString()
        })
      },
      state: 'ENABLED'
    });

    // CloudWatch Dashboard for monitoring
    const dashboard = new cloudwatch.Dashboard(this, 'SpendingInsightsDashboard', {
      dashboardName: 'SpendingInsights-Monitoring',
    });

    // Lambda metrics
    const apiHandlerErrorMetric = apiHandlerLambda.metricErrors({
      period: cdk.Duration.minutes(5),
    });

    const apiHandlerDurationMetric = apiHandlerLambda.metricDuration({
      period: cdk.Duration.minutes(5),
    });

    const weeklyInsightsErrorMetric = weeklyInsightsLambda.metricErrors({
      period: cdk.Duration.minutes(5),
    });

    const weeklyInsightsDurationMetric = weeklyInsightsLambda.metricDuration({
      period: cdk.Duration.minutes(5),
    });

    // API Gateway metrics
    const apiGateway4xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      period: cdk.Duration.minutes(5),
    });

    const apiGateway5xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      period: cdk.Duration.minutes(5),
    });

    // DynamoDB throttle metrics
    const dynamoDbThrottleMetric = new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName: 'ThrottledRequests',
      period: cdk.Duration.minutes(5),
    });

    // Add widgets to dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [apiHandlerErrorMetric, weeklyInsightsErrorMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [apiHandlerDurationMetric, weeklyInsightsDurationMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [apiGateway4xxMetric, apiGateway5xxMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Throttles',
        left: [dynamoDbThrottleMetric],
        width: 12,
        height: 6,
      })
    );



    // Bedrock Agent Configuration

    // IAM Role for Bedrock Agent
    const bedrockAgentRole = new iam.Role(this, 'BedrockAgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
      ],
    });

    // Grant Bedrock Agent permissions to invoke Lambda functions
    bedrockAgentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction',
      ],
      resources: [
        apiHandlerLambda.functionArn,
        transactionProcessorLambda.functionArn,
        weeklyInsightsLambda.functionArn,
      ],
    }));

    // Grant Bedrock Agent permissions to access DynamoDB for memory management
    bedrockAgentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
      ],
      resources: [
        agentMemoryTable.tableArn,
        userProfilesTable.tableArn,
      ],
    }));

    // Bedrock Agent (Note: This creates the agent configuration, but actual agent creation is done via console/CLI)
    const agentInstruction = `You are a financial insights AI agent designed to help women and moms transform their spending data into actionable weekly money wins.

Your core capabilities:
1. Analyze spending patterns and identify trends
2. Categorize transactions intelligently  
3. Detect fees, subscriptions, and unnecessary charges
4. Generate personalized savings recommendations
5. Assess investment readiness for educational purposes

Key principles:
- Focus on small, achievable weekly actions
- Prioritize recommendations by impact vs effort
- Provide clear explanations for all recommendations
- Never give specific financial advice - only educational information
- Always include disclaimers for investment-related content
- Be supportive and encouraging, not judgmental

Memory Management:
- Remember user preferences and past interactions
- Learn from manual categorizations to improve accuracy
- Track implemented recommendations and their outcomes
- Maintain context across multiple conversations

Tool Orchestration:
- Use tools in logical sequence: analyze → categorize → detect fees → generate recommendations
- Combine insights from multiple tools for comprehensive analysis
- Provide reasoning for tool selection and sequencing decisions

Response Format:
- Always explain your reasoning process
- Provide specific, actionable steps
- Include potential savings amounts when relevant
- Use encouraging, supportive language
- End with clear next steps for the user`;

    // Create Bedrock Agent (placeholder - actual creation done via scripts)
    const bedrockAgent = new bedrock.CfnAgent(this, 'SpendingInsightsAgent', {
      agentName: 'spending-insights-ai-agent',
      description: 'AI agent that transforms spending data into actionable weekly money wins for women and moms',
      foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      instruction: agentInstruction,
      agentResourceRoleArn: bedrockAgentRole.roleArn,
      idleSessionTtlInSeconds: 1800, // 30 minutes
      // Memory configuration will be added via console/scripts
    });

    // Note: Action Groups will be configured via AWS Console or CLI scripts
    // CfnAgentActionGroup is not available in CDK yet

    // Grant Bedrock Agent permission to invoke the Lambda function
    apiHandlerLambda.addPermission('BedrockAgentInvoke', {
      principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      sourceArn: `arn:aws:bedrock:${this.region}:${this.account}:agent/${bedrockAgent.attrAgentId}`,
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

    new cdk.CfnOutput(this, 'BedrockAgentId', {
      value: bedrockAgent.attrAgentId,
      description: 'Bedrock Agent ID',
    });

    new cdk.CfnOutput(this, 'BedrockAgentArn', {
      value: bedrockAgent.attrAgentArn,
      description: 'Bedrock Agent ARN',
    });

    new cdk.CfnOutput(this, 'BedrockAgentRoleArn', {
      value: bedrockAgentRole.roleArn,
      description: 'Bedrock Agent IAM Role ARN',
    });

    new cdk.CfnOutput(this, 'AutonomousRunsTableName', {
      value: autonomousRunsTable.tableName,
      description: 'DynamoDB table for autonomous run tracking',
    });

    new cdk.CfnOutput(this, 'InsightsScheduleName', {
      value: insightsSchedule.name || 'spending-insights-daily-generation',
      description: 'EventBridge Scheduler for daily insights generation',
    });

    new cdk.CfnOutput(this, 'CloudWatchDashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL for monitoring',
    });

    new cdk.CfnOutput(this, 'BedrockGuardrailId', {
      value: bedrockGuardrail.attrGuardrailId,
      description: 'Bedrock Guardrail ID for PII protection and financial advice filtering',
    });

    new cdk.CfnOutput(this, 'BedrockGuardrailArn', {
      value: bedrockGuardrail.attrGuardrailArn,
      description: 'Bedrock Guardrail ARN',
    });

    new cdk.CfnOutput(this, 'BedrockGuardrailVersion', {
      value: guardrailVersion.attrVersion,
      description: 'Bedrock Guardrail Version',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 bucket for website hosting',
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `http://${websiteBucket.bucketWebsiteUrl}`,
      description: 'Website URL (S3)',
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Website URL (CloudFront CDN)',
    });

    if (props?.domainName) {
      new cdk.CfnOutput(this, 'CustomDomainUrl', {
        value: `https://${props.domainName}`,
        description: 'Website URL (Custom Domain)',
      });
    }
  }
}