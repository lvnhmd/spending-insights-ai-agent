/**
 * Script to test DynamoDB operations locally with sample data
 * Requirements: 7.6, 8.1, 1.5
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createTransaction,
  getTransaction,
  getTransactionsByWeek,
  createWeeklyInsight,
  getWeeklyInsight,
  setSessionMemory,
  getSessionMemory,
  createUserProfile,
  getUserProfile,
  getOrCreateUserProfile,
} from '../src/database';
import { Transaction, WeeklyInsight, UserProfile, ConversationTurn } from '../src/types';

// Sample data
const TEST_USER_ID = 'test-user-sample';

const sampleTransactions: Transaction[] = [
  {
    id: uuidv4(),
    userId: TEST_USER_ID,
    amount: -4.75,
    description: 'STARBUCKS COFFEE #1234',
    category: 'Food & Dining',
    subcategory: 'Coffee Shops',
    date: new Date('2024-01-15'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.95,
    originalDescription: 'STARBUCKS COFFEE #1234 SEATTLE WA',
    merchantName: 'Starbucks',
    transactionType: 'debit',
  },
  {
    id: uuidv4(),
    userId: TEST_USER_ID,
    amount: -89.32,
    description: 'WHOLE FOODS MARKET',
    category: 'Groceries',
    date: new Date('2024-01-14'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.98,
    merchantName: 'Whole Foods',
    transactionType: 'debit',
  },
  {
    id: uuidv4(),
    userId: TEST_USER_ID,
    amount: -12.99,
    description: 'NETFLIX.COM',
    category: 'Entertainment',
    subcategory: 'Streaming Services',
    date: new Date('2024-01-13'),
    account: 'Chase Credit Card',
    isRecurring: true,
    confidence: 1.0,
    merchantName: 'Netflix',
    transactionType: 'debit',
  },
  {
    id: uuidv4(),
    userId: TEST_USER_ID,
    amount: -45.67,
    description: 'SHELL GAS STATION',
    category: 'Transportation',
    subcategory: 'Gas',
    date: new Date('2024-01-12'),
    account: 'Chase Checking',
    isRecurring: false,
    confidence: 0.92,
    merchantName: 'Shell',
    transactionType: 'debit',
  },
];

const sampleWeeklyInsight: WeeklyInsight = {
  id: uuidv4(),
  userId: TEST_USER_ID,
  weekOf: new Date('2024-01-15'),
  totalSpent: 152.73,
  topCategories: [
    {
      category: 'Groceries',
      totalAmount: 89.32,
      transactionCount: 1,
      averageAmount: 89.32,
      percentOfTotal: 58.5,
    },
    {
      category: 'Transportation',
      totalAmount: 45.67,
      transactionCount: 1,
      averageAmount: 45.67,
      percentOfTotal: 29.9,
    },
    {
      category: 'Entertainment',
      totalAmount: 12.99,
      transactionCount: 1,
      averageAmount: 12.99,
      percentOfTotal: 8.5,
    },
  ],
  recommendations: [
    {
      id: uuidv4(),
      type: 'eliminate_fee',
      title: 'Review Netflix subscription',
      description: 'You have a recurring $12.99 Netflix charge. Consider if you\'re getting value from this service.',
      potentialSavings: 155.88,
      difficulty: 'easy',
      priority: 7,
      actionSteps: [
        'Log into Netflix account',
        'Review viewing history',
        'Cancel if not actively using',
      ],
      reasoning: 'Recurring subscription detected with potential annual savings',
      confidence: 0.85,
      estimatedTimeToImplement: '5 minutes',
      impact: 'medium',
    },
    {
      id: uuidv4(),
      type: 'save',
      title: 'Optimize grocery shopping',
      description: 'Your grocery spending is above average. Consider meal planning and shopping with a list.',
      potentialSavings: 25,
      difficulty: 'medium',
      priority: 6,
      actionSteps: [
        'Plan meals for the week',
        'Create shopping list',
        'Compare prices at different stores',
      ],
      reasoning: 'High grocery spending relative to typical patterns',
      confidence: 0.75,
      estimatedTimeToImplement: '30 minutes',
      impact: 'medium',
    },
  ],
  potentialSavings: 180.88,
  implementedActions: [],
  generatedAt: new Date(),
  weekNumber: 3,
  year: 2024,
};

const sampleUserProfile: UserProfile = {
  userId: TEST_USER_ID,
  email: 'test@example.com',
  name: 'Sarah Johnson',
  financialGoals: [
    'Build emergency fund',
    'Pay off credit card debt',
    'Save for vacation',
  ],
  riskTolerance: 'medium',
  monthlyIncome: 4500,
  monthlyBudget: 3800,
  preferredCategories: [
    'Groceries',
    'Transportation',
    'Entertainment',
    'Food & Dining',
  ],
  notificationPreferences: {
    weeklyInsights: true,
    feeAlerts: true,
    savingsGoals: true,
  },
  onboardingCompleted: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function testDatabaseOperations() {
  console.log('🧪 Testing DynamoDB operations with sample data...\n');

  try {
    // Test 1: User Profile Operations
    console.log('1️⃣ Testing User Profile Operations');
    console.log('Creating user profile...');
    await createUserProfile(sampleUserProfile);
    console.log('✅ User profile created');

    const retrievedProfile = await getUserProfile(TEST_USER_ID);
    console.log('✅ User profile retrieved:', retrievedProfile?.name);

    // Test 2: Transaction Operations
    console.log('\n2️⃣ Testing Transaction Operations');
    console.log('Creating sample transactions...');
    
    for (const transaction of sampleTransactions) {
      await createTransaction(transaction);
      console.log(`✅ Created transaction: ${transaction.description} - $${Math.abs(transaction.amount)}`);
    }

    // Test retrieving a specific transaction
    const firstTransaction = sampleTransactions[0];
    const retrievedTransaction = await getTransaction(
      TEST_USER_ID,
      firstTransaction.id,
      firstTransaction.date
    );
    console.log('✅ Retrieved transaction:', retrievedTransaction?.description);

    // Test weekly query
    const weeklyTransactions = await getTransactionsByWeek(TEST_USER_ID, new Date('2024-01-15'));
    console.log(`✅ Found ${weeklyTransactions.length} transactions for the week`);

    // Test 3: Weekly Insights Operations
    console.log('\n3️⃣ Testing Weekly Insights Operations');
    console.log('Creating weekly insight...');
    await createWeeklyInsight(sampleWeeklyInsight);
    console.log('✅ Weekly insight created');

    const retrievedInsight = await getWeeklyInsight(TEST_USER_ID, sampleWeeklyInsight.weekOf);
    console.log(`✅ Retrieved insight with ${retrievedInsight?.recommendations.length} recommendations`);

    // Test 4: Agent Memory Operations
    console.log('\n4️⃣ Testing Agent Memory Operations');
    const conversationTurn: ConversationTurn = {
      timestamp: new Date(),
      userInput: 'How much did I spend on coffee this week?',
      agentResponse: 'You spent $4.75 on coffee this week at Starbucks.',
      context: { category: 'Food & Dining', amount: 4.75 },
    };

    await setSessionMemory(TEST_USER_ID, 'test-session-123', {
      conversationHistory: [conversationTurn],
    });
    console.log('✅ Session memory set');

    const sessionMemory = await getSessionMemory(TEST_USER_ID);
    console.log(`✅ Retrieved session memory with ${sessionMemory?.conversationHistory.length} conversation turns`);

    // Test 5: Data Consistency Check
    console.log('\n5️⃣ Testing Data Consistency');
    
    // Verify all data is accessible
    const allWeeklyTransactions = await getTransactionsByWeek(TEST_USER_ID, new Date('2024-01-15'));
    const totalSpent = allWeeklyTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    console.log(`✅ Weekly transactions total: $${totalSpent.toFixed(2)}`);
    console.log(`✅ Weekly insight total: $${retrievedInsight?.totalSpent.toFixed(2)}`);
    
    if (Math.abs(totalSpent - (retrievedInsight?.totalSpent || 0)) < 0.01) {
      console.log('✅ Data consistency check passed');
    } else {
      console.log('⚠️ Data consistency check failed - totals don\'t match');
    }

    console.log('\n🎉 All database operations completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- User Profile: ${retrievedProfile?.name}`);
    console.log(`- Transactions: ${sampleTransactions.length} created`);
    console.log(`- Weekly Insight: ${retrievedInsight?.recommendations.length} recommendations`);
    console.log(`- Potential Savings: $${retrievedInsight?.potentialSavings.toFixed(2)}`);
    console.log(`- Session Memory: ${sessionMemory?.conversationHistory.length} conversation turns`);

  } catch (error) {
    console.error('❌ Database operation failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Table not found')) {
        console.log('\n💡 Tip: Make sure DynamoDB tables are deployed first:');
        console.log('   cd infra && npm run cdk:deploy');
      } else if (error.message.includes('credentials')) {
        console.log('\n💡 Tip: Make sure AWS credentials are configured:');
        console.log('   aws configure');
      }
    }
    
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testDatabaseOperations().catch(console.error);
}

export { testDatabaseOperations, sampleTransactions, sampleWeeklyInsight, sampleUserProfile };