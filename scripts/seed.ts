#!/usr/bin/env ts-node

/**
 * Database seeding script for Spending Insights AI Agent
 * 
 * This script will populate DynamoDB tables with sample data
 * for testing and demonstration purposes.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Sample user profile
    await docClient.send(new PutCommand({
      TableName: 'spending-insights-user-profiles',
      Item: {
        userId: 'demo-user-001',
        profileType: 'PROFILE',
        name: 'Demo User',
        preferences: {
          categories: ['groceries', 'dining', 'entertainment', 'utilities'],
          budgetGoals: {
            monthly: 3000,
            savings: 500
          }
        },
        createdAt: new Date().toISOString()
      }
    }));

    // Sample transactions
    const sampleTransactions = [
      {
        userId: 'demo-user-001',
        transactionKey: 'DT#2024-01-15#TX#001',
        userWeekKey: 'USER#demo-user-001#W#2024-W03',
        amount: -45.67,
        description: 'WHOLE FOODS MARKET',
        category: 'groceries',
        date: '2024-01-15',
        account: 'checking-001'
      },
      {
        userId: 'demo-user-001',
        transactionKey: 'DT#2024-01-16#TX#002',
        userWeekKey: 'USER#demo-user-001#W#2024-W03',
        amount: -12.99,
        description: 'NETFLIX SUBSCRIPTION',
        category: 'entertainment',
        date: '2024-01-16',
        account: 'credit-001'
      }
    ];

    for (const transaction of sampleTransactions) {
      await docClient.send(new PutCommand({
        TableName: 'spending-insights-transactions',
        Item: transaction
      }));
    }

    console.log('✅ Database seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase };