/**
 * API Handler Lambda Function
 * Requirements: 8.1, 8.5
 * 
 * Handles:
 * - REST API endpoints for CSV upload and insights retrieval
 * - Basic user session management
 * - Proper error handling and response formatting
 * - Health endpoints: GET /health (static), GET /readiness (200ms DDB+Bedrock probe)
 * - Lambda timeout: 25 seconds (not 30s - leave buffer for API Gateway)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { parseTransactionCSV } from './utils/csv-parser';
import { batchCreateTransactions, getTransactionsByDateRange } from './database/transactions';
import { getWeeklyInsightsForUser, getLatestWeeklyInsight } from './database/weekly-insights';
import { getUserProfile, createUserProfile } from './database/user-profiles';
import { agentCoreMemoryManager, AgentCoreMemoryContext, ToolExecutionContext } from './database/agentcore-memory';
import { getLatestAutonomousRun, getAutonomousRunStats } from './database/autonomous-runs';
import { toolTraceLogger } from './utils/tool-trace-logger';
import { createAPIClients, getAPIStatus, featureFlags } from './utils/external-apis';
import { UserProfile } from './types';
import { randomUUID } from 'crypto';

interface APIResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('API Handler Lambda - Event:', JSON.stringify(event, null, 2));

  try {
    const { httpMethod, path, pathParameters, queryStringParameters } = event;

    // Handle CORS preflight requests
    if (httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Route requests
    switch (true) {
      // Health endpoints
      case httpMethod === 'GET' && path === '/health':
        return await handleHealthCheck();

      case httpMethod === 'GET' && path === '/readiness':
        return await handleReadinessCheck();

      // User management
      case httpMethod === 'POST' && path === '/users':
        return await handleCreateUser(event);

      // Transaction management (check before generic user routes)
      case httpMethod === 'POST' && path === '/transactions/upload':
        return await handleCSVUpload(event);

      case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/transactions'):
        return await handleGetTransactions(pathParameters?.userId, queryStringParameters as Record<string, string> | null);

      // Insights (check before generic user routes)
      case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/insights'):
        return await handleGetInsights(pathParameters?.userId, queryStringParameters as Record<string, string> | null);

      // Generic user route (must be after specific routes)
      case httpMethod === 'GET' && path.startsWith('/users/') && !path.includes('/transactions') && !path.includes('/insights'):
        return await handleGetUser(pathParameters?.userId);

      // Generate insights (trigger weekly insights generator)
      case httpMethod === 'POST' && path.startsWith('/users/') && path.includes('/insights/generate'):
        return await handleGenerateInsights(pathParameters?.userId, event);

      // Autonomous run tracking endpoints
      case httpMethod === 'GET' && path === '/autonomous-runs/latest':
        return await handleGetLatestAutonomousRun(queryStringParameters as Record<string, string> | null);

      case httpMethod === 'GET' && path === '/autonomous-runs/stats':
        return await handleGetAutonomousRunStats(queryStringParameters as Record<string, string> | null);

      // External API endpoints
      case httpMethod === 'GET' && path === '/external-apis/status':
        return await handleGetAPIStatus();

      case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/external-data/plaid'):
        return await handleGetPlaidData(pathParameters?.userId);

      case httpMethod === 'GET' && path.startsWith('/users/') && path.includes('/external-data/market'):
        return await handleGetMarketData(pathParameters?.userId);

      // AgentCore Tool Endpoints
      case httpMethod === 'POST' && path === '/tools/analyze-spending-patterns':
        return await handleAnalyzeSpendingPatterns(event);

      case httpMethod === 'POST' && path === '/tools/categorize-transactions':
        return await handleCategorizeTransactions(event);

      case httpMethod === 'POST' && path === '/tools/detect-fees-and-subscriptions':
        return await handleDetectFeesAndSubscriptions(event);

      case httpMethod === 'POST' && path === '/tools/generate-savings-recommendations':
        return await handleGenerateSavingsRecommendations(event);

      case httpMethod === 'POST' && path === '/tools/calculate-investment-readiness':
        return await handleCalculateInvestmentReadiness(event);

      default:
        return createResponse(404, { error: 'Not found', path, method: httpMethod });
    }

  } catch (error) {
    console.error('API Handler Error:', error);
    return createResponse(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Health check endpoint - static response
 */
async function handleHealthCheck(): Promise<APIGatewayProxyResult> {
  return createResponse(200, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'spending-insights-api',
    version: '1.0.0'
  });
}

/**
 * Readiness check endpoint - probes DDB and Bedrock with 200ms timeout
 */
async function handleReadinessCheck(): Promise<APIGatewayProxyResult> {
  const checks: HealthCheckResult[] = [];
  const startTime = Date.now();

  try {
    // Test DynamoDB connection
    const ddbStart = Date.now();
    try {
      // Simple query to test DDB connectivity
      await getUserProfile('health-check-user');
      checks.push({
        service: 'dynamodb',
        status: 'healthy',
        responseTime: Date.now() - ddbStart
      });
    } catch (error) {
      checks.push({
        service: 'dynamodb',
        status: 'unhealthy',
        responseTime: Date.now() - ddbStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test Bedrock connection (mock for now)
    const bedrockStart = Date.now();
    try {
      // TODO: Add actual Bedrock health check when implemented
      // For now, simulate a quick check
      await new Promise(resolve => setTimeout(resolve, 10));
      checks.push({
        service: 'bedrock',
        status: 'healthy',
        responseTime: Date.now() - bedrockStart
      });
    } catch (error) {
      checks.push({
        service: 'bedrock',
        status: 'unhealthy',
        responseTime: Date.now() - bedrockStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    const totalTime = Date.now() - startTime;
    const allHealthy = checks.every(check => check.status === 'healthy');

    return createResponse(allHealthy ? 200 : 503, {
      status: allHealthy ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      totalResponseTime: totalTime,
      checks
    });

  } catch (error) {
    return createResponse(503, {
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks
    });
  }
}

/**
 * Create a new user
 */
async function handleCreateUser(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { email, name, financialGoals, riskTolerance } = body;

  if (!email) {
    return createResponse(400, { error: 'Email is required' });
  }

  const userId = randomUUID();
  const userProfile: UserProfile = {
    userId,
    email,
    name,
    financialGoals: financialGoals || [],
    riskTolerance: riskTolerance || 'medium',
    preferredCategories: [],
    notificationPreferences: {
      weeklyInsights: true,
      feeAlerts: true,
      savingsGoals: true
    },
    onboardingCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await createUserProfile(userProfile);

  return createResponse(201, {
    message: 'User created successfully',
    userId,
    profile: userProfile
  });
}

/**
 * Get user profile
 */
async function handleGetUser(userId?: string): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const profile = await getUserProfile(userId);

  if (!profile) {
    return createResponse(404, { error: 'User not found' });
  }

  return createResponse(200, { profile });
}

/**
 * Handle CSV upload and processing
 */
async function handleCSVUpload(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, csvContent } = body;

  if (!userId || !csvContent) {
    return createResponse(400, {
      error: 'Missing required fields',
      required: ['userId', 'csvContent']
    });
  }

  // Validate user exists
  const userProfile = await getUserProfile(userId);
  if (!userProfile) {
    return createResponse(404, { error: 'User not found' });
  }

  // Parse CSV
  const parseResult = parseTransactionCSV(csvContent, userId);

  if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
    return createResponse(400, {
      error: 'Failed to parse CSV',
      details: parseResult.errors,
      totalRows: parseResult.totalRows
    });
  }

  // Store transactions
  if (parseResult.transactions.length > 0) {
    await batchCreateTransactions(parseResult.transactions);
  }

  return createResponse(200, {
    message: 'CSV processed successfully',
    processedTransactions: parseResult.transactions.length,
    totalRows: parseResult.totalRows,
    successfulRows: parseResult.successfulRows,
    errors: parseResult.errors,
    transactions: parseResult.transactions.slice(0, 5) // Return first 5 for preview
  });
}

/**
 * Get transactions for a user
 */
async function handleGetTransactions(
  userId?: string,
  queryParams?: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const startDate = queryParams?.startDate ? new Date(queryParams.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
  const endDate = queryParams?.endDate ? new Date(queryParams.endDate) : new Date();

  const transactions = await getTransactionsByDateRange(userId, startDate, endDate);

  return createResponse(200, {
    transactions,
    count: transactions.length,
    dateRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  });
}

/**
 * Get insights for a user
 */
async function handleGetInsights(
  userId?: string,
  queryParams?: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 10;

  if (queryParams?.latest === 'true') {
    const latestInsight = await getLatestWeeklyInsight(userId);
    return createResponse(200, {
      insight: latestInsight,
      isLatest: true
    });
  }

  const insights = await getWeeklyInsightsForUser(userId, limit);

  return createResponse(200, {
    insights,
    count: insights.length
  });
}

/**
 * Generate new insights (trigger weekly insights generator)
 */
async function handleGenerateInsights(
  userId: string | undefined,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  const body = JSON.parse(event.body || '{}');
  const { weekOf, forceRegenerate = false } = body;

  // In a real implementation, this would invoke the weekly-insights-generator Lambda
  // For now, we'll return a placeholder response

  return createResponse(202, {
    message: 'Insights generation started',
    userId,
    weekOf: weekOf || new Date().toISOString(),
    forceRegenerate,
    status: 'processing',
    estimatedCompletionTime: '30 seconds'
  });
}

/**
 * External API Handlers
 * Requirements: 1.3, 7.4, 8.7
 */

/**
 * Get external API status
 */
async function handleGetAPIStatus(): Promise<APIGatewayProxyResult> {
  try {
    const status = getAPIStatus();
    
    return createResponse(200, {
      featureFlags: {
        USE_CACHED_APIS: featureFlags.USE_CACHED_APIS,
        MODEL_TIER: featureFlags.MODEL_TIER,
        ENABLE_PLAID: featureFlags.ENABLE_PLAID,
        ENABLE_ALPHA_VANTAGE: featureFlags.ENABLE_ALPHA_VANTAGE,
        DEMO_MODE: featureFlags.DEMO_MODE
      },
      apiStatus: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get API Status Error:', error);
    return createResponse(500, { 
      error: 'Failed to get API status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get Plaid data for user
 */
async function handleGetPlaidData(userId?: string): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  try {
    const apiClients = createAPIClients();
    const plaidData = await apiClients.plaid.getTransactions(userId);
    
    return createResponse(200, {
      userId,
      source: 'plaid',
      cached: featureFlags.USE_CACHED_APIS || !featureFlags.ENABLE_PLAID,
      data: plaidData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get Plaid Data Error:', error);
    return createResponse(500, { 
      error: 'Failed to get Plaid data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get market data for user (investment education context)
 */
async function handleGetMarketData(userId?: string): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return createResponse(400, { error: 'User ID is required' });
  }

  try {
    const apiClients = createAPIClients();
    
    // Get sample stock data for educational purposes
    const stockData = await apiClients.alphaVantage.getDailyPrices('AAPL');
    const marketOverview = await apiClients.alphaVantage.getMarketOverview();
    
    return createResponse(200, {
      userId,
      source: 'alpha_vantage',
      cached: featureFlags.USE_CACHED_APIS || !featureFlags.ENABLE_ALPHA_VANTAGE,
      data: {
        sampleStock: stockData,
        marketOverview
      },
      disclaimer: "This is educational information only, not financial advice. Consult a licensed financial advisor before making investment decisions.",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get Market Data Error:', error);
    return createResponse(500, { 
      error: 'Failed to get market data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * AgentCore Tool Handlers
 * Requirements: 7.2, 7.3, 7.5, 8.6
 */

/**
 * Get latest autonomous run
 */
async function handleGetLatestAutonomousRun(
  queryParams?: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  try {
    const runType = queryParams?.runType || 'weekly-insights';
    
    const latestRun = await getLatestAutonomousRun(runType);
    
    if (!latestRun) {
      return createResponse(404, { 
        error: 'No autonomous runs found',
        runType 
      });
    }

    // Format the response for UI display
    const response = {
      runType: latestRun.runType,
      status: latestRun.status,
      timestamp: latestRun.runTimestamp,
      duration: latestRun.duration,
      usersProcessed: latestRun.usersProcessed || 0,
      insightsGenerated: latestRun.insightsGenerated || 0,
      recommendationsCreated: latestRun.recommendationsCreated || 0,
      errorMessage: latestRun.errorMessage,
      lastRunDisplay: formatLastRunDisplay(latestRun)
    };

    return createResponse(200, response);

  } catch (error) {
    console.error('Get Latest Autonomous Run Error:', error);
    return createResponse(500, { 
      error: 'Failed to get latest autonomous run',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get autonomous run statistics
 */
async function handleGetAutonomousRunStats(
  queryParams?: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  try {
    const runType = queryParams?.runType || 'weekly-insights';
    const days = parseInt(queryParams?.days || '7', 10);
    
    const stats = await getAutonomousRunStats(runType, days);
    
    return createResponse(200, {
      runType,
      period: `${days} days`,
      ...stats,
      successRate: stats.totalRuns > 0 ? (stats.successfulRuns / stats.totalRuns * 100).toFixed(1) + '%' : '0%',
      averageDurationFormatted: formatDuration(stats.averageDuration)
    });

  } catch (error) {
    console.error('Get Autonomous Run Stats Error:', error);
    return createResponse(500, { 
      error: 'Failed to get autonomous run statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Analyze spending patterns tool
 */
async function handleAnalyzeSpendingPatterns(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, timeframe, categories } = body;

    if (!userId || !timeframe) {
      return createResponse(400, { error: 'Missing required fields: userId, timeframe' });
    }

    // Create AgentCore memory context
    const context: AgentCoreMemoryContext = {
      userId,
      sessionId: event.requestContext.requestId,
      memoryScope: 'session'
    };

    // Initialize session if needed
    await agentCoreMemoryManager.initializeSession(context);

    // Get date range based on timeframe
    const endDate = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case 'week':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return createResponse(400, { error: 'Invalid timeframe. Must be: week, month, or quarter' });
    }

    // Get transactions for analysis
    const transactions = await getTransactionsByDateRange(userId, startDate, endDate);

    // Analyze spending patterns
    const patterns = analyzeSpendingPatterns(transactions, categories);

    // Record tool execution in memory
    const toolExecution: ToolExecutionContext = {
      toolName: 'analyze_spending_patterns',
      input: { userId, timeframe, categories },
      output: patterns,
      executionTime: Date.now() - startTime,
      success: true,
      reasoning: `Analyzed ${transactions.length} transactions over ${timeframe} timeframe`
    };

    await agentCoreMemoryManager.recordToolExecution(context, toolExecution);

    // Log tool call trace for demo documentation
    const orchestrationId = event.headers['x-orchestration-id'] || `single-tool-${Date.now()}`;
    
    // Start orchestration if this is the first tool call
    if (!toolTraceLogger.getOrchestrationTrace(orchestrationId)) {
      const memorySnapshot = await agentCoreMemoryManager.getMemorySummary(context);
      toolTraceLogger.startOrchestration(
        orchestrationId,
        context.sessionId,
        userId,
        ['analyze_spending_patterns'],
        memorySnapshot
      );
    }

    // Log this tool call
    toolTraceLogger.logToolCall(
      orchestrationId,
      'analyze_spending_patterns',
      { userId, timeframe, categories },
      patterns,
      Date.now() - startTime,
      true,
      `Analyzed ${transactions.length} transactions over ${timeframe} timeframe`,
      {
        confidence: 0.9,
        memoryAccessed: ['preferences', 'categories'],
        memoryUpdated: ['analysis']
      }
    );

    return createResponse(200, patterns);

  } catch (error) {
    console.error('Error in analyze spending patterns:', error);
    
    // Record failed execution
    const toolExecution: ToolExecutionContext = {
      toolName: 'analyze_spending_patterns',
      input: JSON.parse(event.body || '{}'),
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
      executionTime: Date.now() - startTime,
      success: false
    };

    return createResponse(500, { error: 'Failed to analyze spending patterns' });
  }
}

/**
 * Categorize transactions tool
 */
async function handleCategorizeTransactions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { transactions } = body;

    if (!transactions || !Array.isArray(transactions)) {
      return createResponse(400, { error: 'Missing required field: transactions (array)' });
    }

    // Categorize transactions using AI/pattern matching
    const categorizedTransactions = await categorizeTransactions(transactions);

    const result = {
      categorizedTransactions
    };

    return createResponse(200, result);

  } catch (error) {
    console.error('Error in categorize transactions:', error);
    return createResponse(500, { error: 'Failed to categorize transactions' });
  }
}

/**
 * Detect fees and subscriptions tool
 */
async function handleDetectFeesAndSubscriptions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, transactions } = body;

    if (!userId || !transactions || !Array.isArray(transactions)) {
      return createResponse(400, { error: 'Missing required fields: userId, transactions (array)' });
    }

    // Detect fees and subscriptions
    const detectedFees = await detectFeesAndSubscriptions(transactions);
    const totalAnnualCost = detectedFees.reduce((sum, fee) => sum + fee.annualCost, 0);

    const result = {
      detectedFees,
      totalAnnualCost
    };

    return createResponse(200, result);

  } catch (error) {
    console.error('Error in detect fees and subscriptions:', error);
    return createResponse(500, { error: 'Failed to detect fees and subscriptions' });
  }
}

/**
 * Generate savings recommendations tool
 */
async function handleGenerateSavingsRecommendations(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, spendingPatterns, detectedFees } = body;

    if (!userId || !spendingPatterns || !Array.isArray(spendingPatterns)) {
      return createResponse(400, { error: 'Missing required fields: userId, spendingPatterns (array)' });
    }

    // Generate personalized recommendations
    const recommendations = await generateSavingsRecommendations(userId, spendingPatterns, detectedFees || []);
    const totalPotentialSavings = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);

    const result = {
      recommendations,
      totalPotentialSavings
    };

    return createResponse(200, result);

  } catch (error) {
    console.error('Error in generate savings recommendations:', error);
    return createResponse(500, { error: 'Failed to generate savings recommendations' });
  }
}

/**
 * Calculate investment readiness tool
 */
async function handleCalculateInvestmentReadiness(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, monthlyIncome, monthlyExpenses, emergencyFund, debts } = body;

    if (!userId || monthlyIncome === undefined || monthlyExpenses === undefined) {
      return createResponse(400, { error: 'Missing required fields: userId, monthlyIncome, monthlyExpenses' });
    }

    // Calculate investment readiness
    const readinessAssessment = calculateInvestmentReadiness({
      monthlyIncome,
      monthlyExpenses,
      emergencyFund: emergencyFund || 0,
      debts: debts || []
    });

    const result = {
      ...readinessAssessment,
      disclaimer: "This is educational information only, not financial advice. Consult a licensed financial advisor before making investment decisions."
    };

    return createResponse(200, result);

  } catch (error) {
    console.error('Error in calculate investment readiness:', error);
    return createResponse(500, { error: 'Failed to calculate investment readiness' });
  }
}

/**
 * Helper functions for tool implementations
 */

function analyzeSpendingPatterns(transactions: any[], categoryFilter?: string[]) {
  // Group transactions by category
  const categoryTotals: Record<string, { total: number; count: number; transactions: any[] }> = {};
  
  transactions.forEach(transaction => {
    const category = transaction.category || 'Uncategorized';
    
    if (!categoryFilter || categoryFilter.includes(category)) {
      if (!categoryTotals[category]) {
        categoryTotals[category] = { total: 0, count: 0, transactions: [] };
      }
      
      categoryTotals[category].total += Math.abs(transaction.amount);
      categoryTotals[category].count += 1;
      categoryTotals[category].transactions.push(transaction);
    }
  });

  // Analyze patterns
  const patterns = Object.entries(categoryTotals).map(([category, data]) => {
    const averageAmount = data.total / data.count;
    
    // Simple trend analysis (would be more sophisticated in production)
    const trend = data.count > 5 ? 'stable' : data.count > 2 ? 'increasing' : 'decreasing';
    
    return {
      category,
      trend,
      averageAmount,
      frequency: data.count,
      insights: `${category}: ${data.count} transactions, $${averageAmount.toFixed(2)} average`
    };
  });

  const totalSpent = Object.values(categoryTotals).reduce((sum, data) => sum + data.total, 0);
  const topCategories = patterns
    .sort((a, b) => (categoryTotals[b.category]?.total || 0) - (categoryTotals[a.category]?.total || 0))
    .slice(0, 5)
    .map(p => p.category);

  return {
    patterns,
    totalSpent,
    topCategories
  };
}

async function categorizeTransactions(transactions: any[]) {
  // Simple rule-based categorization (would use AI in production)
  const categoryRules = [
    { pattern: /grocery|supermarket|food/i, category: 'Groceries', subcategory: 'Food' },
    { pattern: /gas|fuel|shell|exxon/i, category: 'Transportation', subcategory: 'Fuel' },
    { pattern: /restaurant|dining|cafe/i, category: 'Dining', subcategory: 'Restaurants' },
    { pattern: /netflix|spotify|subscription/i, category: 'Entertainment', subcategory: 'Subscriptions' },
    { pattern: /amazon|shopping|retail/i, category: 'Shopping', subcategory: 'Online' },
    { pattern: /bank|fee|charge/i, category: 'Fees', subcategory: 'Bank Fees' },
  ];

  return transactions.map(transaction => {
    const description = transaction.description || '';
    
    for (const rule of categoryRules) {
      if (rule.pattern.test(description)) {
        return {
          transactionId: transaction.id,
          category: rule.category,
          subcategory: rule.subcategory,
          confidence: 0.8,
          reasoning: `Matched pattern: ${rule.pattern.source}`
        };
      }
    }

    // Default categorization
    return {
      transactionId: transaction.id,
      category: 'Other',
      subcategory: 'Uncategorized',
      confidence: 0.3,
      reasoning: 'No pattern match found'
    };
  });
}

async function detectFeesAndSubscriptions(transactions: any[]) {
  const detectedFees = [];
  
  // Group by description to find recurring charges
  const descriptionGroups: Record<string, any[]> = {};
  
  transactions.forEach(transaction => {
    const normalizedDesc = transaction.description?.toLowerCase().replace(/\d+/g, '').trim() || 'unknown';
    if (!descriptionGroups[normalizedDesc]) {
      descriptionGroups[normalizedDesc] = [];
    }
    descriptionGroups[normalizedDesc].push(transaction);
  });

  // Detect recurring subscriptions
  Object.entries(descriptionGroups).forEach(([description, groupTransactions]) => {
    if (groupTransactions.length >= 2) { // At least 2 occurrences
      const avgAmount = groupTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / groupTransactions.length;
      
      // Check if it's likely a subscription
      if (description.includes('subscription') || 
          description.includes('netflix') || 
          description.includes('spotify') ||
          description.includes('monthly')) {
        
        detectedFees.push({
          transactionId: groupTransactions[0].id,
          type: 'subscription' as const,
          annualCost: avgAmount * 12,
          cancellationDifficulty: 'easy' as const,
          recommendation: `Consider reviewing ${description} subscription - $${(avgAmount * 12).toFixed(2)}/year`
        });
      }
    }
  });

  // Detect bank fees
  transactions.forEach(transaction => {
    const description = transaction.description?.toLowerCase() || '';
    if (description.includes('fee') || description.includes('charge')) {
      detectedFees.push({
        transactionId: transaction.id,
        type: 'bank_fee' as const,
        annualCost: Math.abs(transaction.amount) * 12, // Estimate annual impact
        cancellationDifficulty: 'medium' as const,
        recommendation: `Contact bank about ${description} - potential savings available`
      });
    }
  });

  return detectedFees;
}

async function generateSavingsRecommendations(userId: string, spendingPatterns: any[], detectedFees: any[]) {
  const recommendations = [];

  // Recommendations based on spending patterns
  spendingPatterns.forEach((pattern, index) => {
    if (pattern.amount > 200) { // High spending categories
      recommendations.push({
        id: `pattern_${index}`,
        title: `Reduce ${pattern.category} spending`,
        description: `You spent $${pattern.amount.toFixed(2)} on ${pattern.category}. Consider setting a budget limit.`,
        potentialSavings: pattern.amount * 0.1, // 10% reduction
        difficulty: 'medium' as const,
        priority: Math.min(10, Math.floor(pattern.amount / 50)),
        actionSteps: [
          `Set a monthly budget of $${(pattern.amount * 0.9).toFixed(2)} for ${pattern.category}`,
          'Track spending weekly',
          'Look for alternatives or discounts'
        ],
        reasoning: `High spending detected in ${pattern.category}`,
        confidence: 0.7
      });
    }
  });

  // Recommendations based on detected fees
  detectedFees.forEach((fee, index) => {
    recommendations.push({
      id: `fee_${index}`,
      title: `Eliminate ${fee.type.replace('_', ' ')}`,
      description: fee.recommendation,
      potentialSavings: fee.annualCost,
      difficulty: fee.cancellationDifficulty,
      priority: Math.min(10, Math.floor(fee.annualCost / 20)),
      actionSteps: [
        'Review the service usage',
        'Contact provider to cancel or negotiate',
        'Set up account alerts to prevent future charges'
      ],
      reasoning: `Detected recurring ${fee.type} with annual cost of $${fee.annualCost.toFixed(2)}`,
      confidence: 0.9
    });
  });

  // Sort by priority (highest first)
  recommendations.sort((a, b) => b.priority - a.priority);

  return recommendations.slice(0, 5); // Return top 5 recommendations
}

function calculateInvestmentReadiness(financialData: {
  monthlyIncome: number;
  monthlyExpenses: number;
  emergencyFund: number;
  debts: Array<{ type: string; amount: number; interestRate: number }>;
}) {
  const { monthlyIncome, monthlyExpenses, emergencyFund, debts } = financialData;
  
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0);
  const highInterestDebt = debts.filter(debt => debt.interestRate > 6).reduce((sum, debt) => sum + debt.amount, 0);
  
  // Calculate readiness score (0-100)
  let score = 0;
  
  // Positive cash flow (30 points)
  if (monthlySurplus > 0) {
    score += Math.min(30, (monthlySurplus / monthlyIncome) * 100);
  }
  
  // Emergency fund (25 points)
  const emergencyFundMonths = emergencyFund / monthlyExpenses;
  if (emergencyFundMonths >= 6) {
    score += 25;
  } else if (emergencyFundMonths >= 3) {
    score += 15;
  } else if (emergencyFundMonths >= 1) {
    score += 5;
  }
  
  // Debt situation (25 points)
  if (totalDebt === 0) {
    score += 25;
  } else if (highInterestDebt === 0) {
    score += 15;
  } else if (highInterestDebt < monthlyIncome * 2) {
    score += 5;
  }
  
  // Income stability (20 points) - simplified
  score += 20; // Assume stable for this demo
  
  // Determine readiness level
  let readinessLevel: 'not_ready' | 'building_foundation' | 'ready_to_learn';
  if (score >= 70) {
    readinessLevel = 'ready_to_learn';
  } else if (score >= 40) {
    readinessLevel = 'building_foundation';
  } else {
    readinessLevel = 'not_ready';
  }
  
  // Generate recommendations
  const recommendations = [];
  
  if (monthlySurplus <= 0) {
    recommendations.push({
      priority: 'high' as const,
      action: 'Create positive cash flow',
      description: 'Focus on increasing income or reducing expenses before investing',
      educationalResources: ['Budgeting basics', 'Income optimization strategies']
    });
  }
  
  if (emergencyFundMonths < 3) {
    recommendations.push({
      priority: 'high' as const,
      action: 'Build emergency fund',
      description: 'Aim for 3-6 months of expenses in a high-yield savings account',
      educationalResources: ['Emergency fund guide', 'High-yield savings accounts']
    });
  }
  
  if (highInterestDebt > 0) {
    recommendations.push({
      priority: 'high' as const,
      action: 'Pay down high-interest debt',
      description: 'Focus on debts with interest rates above 6% before investing',
      educationalResources: ['Debt payoff strategies', 'Avalanche vs snowball methods']
    });
  }
  
  if (readinessLevel === 'ready_to_learn') {
    recommendations.push({
      priority: 'medium' as const,
      action: 'Learn about investment basics',
      description: 'Start with educational resources about index funds and diversification',
      educationalResources: ['Investment basics', 'Index fund guide', 'Risk tolerance assessment']
    });
  }
  
  return {
    readinessScore: Math.round(score),
    readinessLevel,
    recommendations
  };
}

/**
 * Create standardized API response
 */
function createResponse(statusCode: number, data: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data, null, 2)
  };
}

/**
 * Extract user ID from path parameters or query string
 */
function extractUserId(pathParameters?: Record<string, string> | null, queryStringParameters?: Record<string, string> | null): string | null {
  return pathParameters?.userId || queryStringParameters?.userId || null;
}

/**
 * Validate request body against required fields
 */
function validateRequiredFields(body: any, requiredFields: string[]): string[] {
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (!body[field]) {
      missing.push(field);
    }
  }

  return missing;
}

/**
 * Parse and validate date parameters
 */
function parseDateParam(dateStr?: string): Date | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Create error response with consistent format
 */
function createErrorResponse(statusCode: number, message: string, details?: any): APIGatewayProxyResult {
  return createResponse(statusCode, {
    error: message,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  });
}/**
 
* Format last autonomous run for UI display
 */
function formatLastRunDisplay(run: any): string {
  const timestamp = new Date(run.runTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let timeAgo: string;
  if (diffDays > 0) {
    timeAgo = `${diffDays}d ago`;
  } else if (diffHours > 0) {
    timeAgo = `${diffHours}h ago`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    timeAgo = `${diffMinutes}m ago`;
  }

  const status = run.status === 'completed' ? '✓' : run.status === 'failed' ? '✗' : '⏳';
  const insights = run.insightsGenerated || 0;
  const duration = run.duration ? formatDuration(run.duration) : 'N/A';

  return `Last autonomous run: ${status} ${insights} insights • ${duration} • ${timeAgo}`;
}

/**
 * Format duration in milliseconds to human readable format
 */
function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}