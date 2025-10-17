/**
 * Transaction Processor Lambda Function
 * Requirements: 1.2, 1.4, 3.1, 3.2, 7.3
 * 
 * Handles:
 * - Transaction categorization using Claude 3 Haiku
 * - Fee and subscription detection
 * - Pattern recognition for recurring charges
 * - Mock mode for testing without AWS calls
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { parseTransactionCSV } from './utils/csv-parser';
import { batchCreateTransactions } from './database/transactions';
import { Transaction } from './types';

// Mock responses for testing
const MOCK_CATEGORIZATION_RESPONSE = {
  category: 'Groceries',
  subcategory: 'Supermarket',
  confidence: 0.85,
  isRecurring: false,
  merchantName: 'WHOLE FOODS'
};

const MOCK_FEE_DETECTION_RESPONSE = {
  isSubscription: false,
  isFee: false,
  recurringPattern: undefined,
  annualCost: 0
};

interface TransactionProcessorEvent {
  userId: string;
  csvContent?: string;
  transactions?: Transaction[];
  operation: 'categorize' | 'detect_fees' | 'process_csv';
}

interface CategorizationResult {
  transactionId: string;
  category: string;
  subcategory?: string;
  confidence: number;
  isRecurring: boolean;
  merchantName?: string;
  reasoning?: string;
}

interface FeeDetectionResult {
  transactionId: string;
  isSubscription: boolean;
  isFee: boolean;
  recurringPattern?: {
    frequency: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
    amount: number;
    lastSeen: Date;
    occurrences: number;
  };
  annualCost: number;
  confidence: number;
  reasoning?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent | TransactionProcessorEvent,
  context: Context
): Promise<APIGatewayProxyResult | any> => {
  console.log('Transaction Processor Lambda - Event:', JSON.stringify(event, null, 2));

  try {
    // Handle API Gateway events
    if ('httpMethod' in event) {
      return await handleApiGatewayEvent(event as APIGatewayProxyEvent);
    }

    // Handle direct Lambda invocation
    const processorEvent = event as TransactionProcessorEvent;
    
    switch (processorEvent.operation) {
      case 'process_csv':
        return await processCSVTransactions(processorEvent);
      case 'categorize':
        return await categorizeTransactions(processorEvent);
      case 'detect_fees':
        return await detectFeesAndSubscriptions(processorEvent);
      default:
        throw new Error(`Unknown operation: ${processorEvent.operation}`);
    }

  } catch (error) {
    console.error('Transaction Processor Error:', error);
    
    if ('httpMethod' in event) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      };
    }
    
    throw error;
  }
};

/**
 * Handle API Gateway events for CSV upload processing
 */
async function handleApiGatewayEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  if (httpMethod === 'POST' && path === '/process-csv') {
    const body = JSON.parse(event.body || '{}');
    const { userId, csvContent } = body;

    if (!userId || !csvContent) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Missing required fields: userId, csvContent'
        })
      };
    }

    const result = await processCSVTransactions({ userId, csvContent, operation: 'process_csv' });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result)
    };
  }

  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ error: 'Not found' })
  };
}

/**
 * Process CSV content and categorize transactions
 */
async function processCSVTransactions(event: TransactionProcessorEvent) {
  const { userId, csvContent } = event;

  if (!csvContent) {
    throw new Error('CSV content is required');
  }

  // Parse CSV
  const parseResult = parseTransactionCSV(csvContent, userId);
  
  if (parseResult.errors.length > 0) {
    console.warn('CSV parsing errors:', parseResult.errors);
  }

  if (parseResult.transactions.length === 0) {
    return {
      success: false,
      message: 'No valid transactions found in CSV',
      errors: parseResult.errors,
      processedCount: 0
    };
  }

  // Categorize transactions
  const categorizedTransactions = await Promise.all(
    parseResult.transactions.map(async (transaction) => {
      const categorization = await categorizeTransaction(transaction);
      const feeDetection = await detectTransactionFees(transaction);

      return {
        ...transaction,
        category: categorization.category,
        subcategory: categorization.subcategory,
        confidence: categorization.confidence,
        isRecurring: categorization.isRecurring || feeDetection.isSubscription,
        merchantName: categorization.merchantName || transaction.merchantName
      };
    })
  );

  // Store transactions in database
  await batchCreateTransactions(categorizedTransactions);

  // Detect fees and subscriptions
  const feeDetectionResults = await Promise.all(
    categorizedTransactions.map(transaction => detectTransactionFees(transaction))
  );

  const detectedFees = feeDetectionResults.filter(result => result.isFee || result.isSubscription);

  return {
    success: true,
    message: `Processed ${categorizedTransactions.length} transactions`,
    processedCount: categorizedTransactions.length,
    errors: parseResult.errors,
    categorizedTransactions: categorizedTransactions.length,
    detectedFees: detectedFees.length,
    feeDetails: detectedFees
  };
}

/**
 * Categorize a batch of transactions
 */
async function categorizeTransactions(event: TransactionProcessorEvent) {
  const { transactions } = event;

  if (!transactions || transactions.length === 0) {
    throw new Error('Transactions array is required');
  }

  const results = await Promise.all(
    transactions.map(transaction => categorizeTransaction(transaction))
  );

  return {
    success: true,
    results
  };
}

/**
 * Detect fees and subscriptions in transactions
 */
async function detectFeesAndSubscriptions(event: TransactionProcessorEvent) {
  const { transactions } = event;

  if (!transactions || transactions.length === 0) {
    throw new Error('Transactions array is required');
  }

  const results = await Promise.all(
    transactions.map(transaction => detectTransactionFees(transaction))
  );

  const fees = results.filter(result => result.isFee || result.isSubscription);

  return {
    success: true,
    totalTransactions: transactions.length,
    feesDetected: fees.length,
    results: fees
  };
}

/**
 * Categorize a single transaction using AI or mock data
 */
async function categorizeTransaction(transaction: Transaction): Promise<CategorizationResult> {
  // Check if we're in mock mode
  if (process.env.MODEL_MODE === 'mock') {
    return mockTransactionCategorization(transaction);
  }

  try {
    // Use Claude 3 Haiku for categorization
    const categorization = await callBedrockForCategorization(transaction);
    return {
      transactionId: transaction.id,
      ...categorization
    };
  } catch (error) {
    console.warn('Bedrock categorization failed, using fallback:', error);
    return mockTransactionCategorization(transaction);
  }
}

/**
 * Detect fees and subscriptions for a single transaction
 */
async function detectTransactionFees(transaction: Transaction): Promise<FeeDetectionResult> {
  // Check if we're in mock mode
  if (process.env.MODEL_MODE === 'mock') {
    return mockFeeDetection(transaction);
  }

  try {
    // Use pattern recognition and AI for fee detection
    const feeDetection = await analyzeTransactionForFees(transaction);
    return {
      transactionId: transaction.id,
      ...feeDetection
    };
  } catch (error) {
    console.warn('Fee detection failed, using fallback:', error);
    return mockFeeDetection(transaction);
  }
}

/**
 * Mock transaction categorization for testing
 */
function mockTransactionCategorization(transaction: Transaction): CategorizationResult {
  const description = transaction.description.toLowerCase();
  
  // Simple rule-based categorization for testing
  let category = 'Other';
  let subcategory: string | undefined;
  let isRecurring = false;
  
  if (description.includes('grocery') || description.includes('supermarket') || description.includes('whole foods')) {
    category = 'Groceries';
    subcategory = 'Supermarket';
  } else if (description.includes('gas') || description.includes('fuel') || description.includes('shell') || description.includes('exxon')) {
    category = 'Transportation';
    subcategory = 'Gas';
  } else if (description.includes('restaurant') || description.includes('food') || description.includes('dining')) {
    category = 'Dining';
    subcategory = 'Restaurant';
  } else if (description.includes('netflix') || description.includes('spotify') || description.includes('subscription')) {
    category = 'Entertainment';
    subcategory = 'Streaming';
    isRecurring = true;
  } else if (description.includes('amazon') || description.includes('target') || description.includes('walmart')) {
    category = 'Shopping';
    subcategory = 'Retail';
  } else if (description.includes('utility') || description.includes('electric') || description.includes('water')) {
    category = 'Utilities';
    isRecurring = true;
  } else if (description.includes('bank') || description.includes('fee') || description.includes('charge')) {
    category = 'Fees';
    subcategory = 'Bank Fee';
  }

  return {
    transactionId: transaction.id,
    category,
    subcategory,
    confidence: 0.75, // Mock confidence
    isRecurring,
    merchantName: transaction.merchantName,
    reasoning: `Mock categorization based on description keywords`
  };
}

/**
 * Mock fee detection for testing
 */
function mockFeeDetection(transaction: Transaction): FeeDetectionResult {
  const description = transaction.description.toLowerCase();
  const amount = transaction.amount;
  
  let isSubscription = false;
  let isFee = false;
  let recurringPattern: FeeDetectionResult['recurringPattern'];
  let annualCost = 0;
  
  // Detect subscriptions
  if (description.includes('netflix') || description.includes('spotify') || description.includes('subscription')) {
    isSubscription = true;
    recurringPattern = {
      frequency: 'monthly',
      amount,
      lastSeen: transaction.date,
      occurrences: 1
    };
    annualCost = amount * 12;
  }
  
  // Detect fees
  if (description.includes('fee') || description.includes('charge') || description.includes('overdraft')) {
    isFee = true;
    annualCost = amount * 12; // Assume monthly for estimation
  }
  
  // Detect recurring patterns by amount ranges
  if (amount > 0 && amount < 50 && (description.includes('monthly') || isSubscription)) {
    isSubscription = true;
    annualCost = amount * 12;
  }

  return {
    transactionId: transaction.id,
    isSubscription,
    isFee,
    recurringPattern,
    annualCost,
    confidence: 0.8,
    reasoning: `Mock fee detection based on description and amount patterns`
  };
}

/**
 * Call Bedrock for transaction categorization (placeholder for real implementation)
 */
async function callBedrockForCategorization(transaction: Transaction): Promise<Omit<CategorizationResult, 'transactionId'>> {
  // This would be the real Bedrock API call
  // For now, return mock data to avoid AWS calls during development
  
  const prompt = `
    Categorize this financial transaction:
    Description: ${transaction.description}
    Amount: $${transaction.amount}
    Date: ${transaction.date.toISOString()}
    
    Provide a JSON response with:
    - category: main category (e.g., "Groceries", "Transportation", "Entertainment")
    - subcategory: specific subcategory (optional)
    - confidence: confidence score 0-1
    - isRecurring: boolean if this appears to be a recurring charge
    - merchantName: cleaned merchant name
    - reasoning: brief explanation
  `;

  // Check if we should use real Bedrock or mock data
  if (process.env.MODEL_MODE !== 'bedrock') {
    return {
      category: MOCK_CATEGORIZATION_RESPONSE.category,
      subcategory: MOCK_CATEGORIZATION_RESPONSE.subcategory,
      confidence: MOCK_CATEGORIZATION_RESPONSE.confidence,
      isRecurring: MOCK_CATEGORIZATION_RESPONSE.isRecurring,
      merchantName: MOCK_CATEGORIZATION_RESPONSE.merchantName,
      reasoning: 'Mock categorization for development'
    };
  }

  try {
    // Import the secure Bedrock client
    const { createSecureBedrockClient } = await import('./utils/bedrock-client');
    const client = createSecureBedrockClient();
    
    const result = await client.categorizeTransaction({
      description: transaction.description,
      amount: transaction.amount,
      date: transaction.date.toISOString(),
    });

    // Map the result to our expected format
    return {
      category: result.category,
      subcategory: result.subcategory,
      confidence: result.confidence,
      isRecurring: transaction.description.toLowerCase().includes('subscription') || 
                   transaction.description.toLowerCase().includes('monthly'),
      merchantName: transaction.description.split(' ')[0], // Simple merchant extraction
      reasoning: result.reasoning,
    };

  } catch (error) {
    console.warn('Bedrock categorization with guardrails failed, using fallback:', error);
    return {
      category: MOCK_CATEGORIZATION_RESPONSE.category,
      subcategory: MOCK_CATEGORIZATION_RESPONSE.subcategory,
      confidence: MOCK_CATEGORIZATION_RESPONSE.confidence,
      isRecurring: MOCK_CATEGORIZATION_RESPONSE.isRecurring,
      merchantName: MOCK_CATEGORIZATION_RESPONSE.merchantName,
      reasoning: 'Fallback categorization due to Bedrock error'
    };
  }
}

/**
 * Analyze transaction for fees and subscriptions (placeholder for real implementation)
 */
async function analyzeTransactionForFees(transaction: Transaction): Promise<Omit<FeeDetectionResult, 'transactionId'>> {
  // This would include pattern recognition and AI analysis
  // For now, return mock data
  
  return {
    isSubscription: MOCK_FEE_DETECTION_RESPONSE.isSubscription,
    isFee: MOCK_FEE_DETECTION_RESPONSE.isFee,
    recurringPattern: MOCK_FEE_DETECTION_RESPONSE.recurringPattern,
    annualCost: MOCK_FEE_DETECTION_RESPONSE.annualCost,
    confidence: 0.7,
    reasoning: 'Mock fee detection for development'
  };
}