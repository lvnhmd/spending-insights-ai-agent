/**
 * Database operations index - exports all DynamoDB CRUD operations
 * Requirements: 7.6, 8.1, 1.5
 */

// DynamoDB client and utilities
export * from './dynamodb-client';

// Table operations
export * from './transactions';
export * from './daily-insights';
export * from './agent-memory';
export * from './user-profiles';

// Re-export types for convenience (excluding UserProfile to avoid conflict)
export type { Transaction, WeeklyInsight, AgentMemory, UserPreference, CategoryMapping, ConversationTurn } from '../types';