/**
 * DynamoDB CRUD operations for agent memory table
 * Requirements: 7.6, 8.1, 1.5
 */

import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES, withErrorHandling, generateScopeKey, generateUserKey, generateTTL } from './dynamodb-client';
import { AgentMemory, ConversationTurn, UserPreference, CategoryMapping } from '../types';

export interface AgentMemoryRecord {
  userId: string;
  memoryScope: string; // SCOPE#scope
  conversationHistory?: ConversationTurn[];
  learnedPreferences?: UserPreference[];
  categoryMappings?: CategoryMapping[];
  lastAnalysisDate?: string;
  sessionId?: string;
  ttl?: number; // TTL for short-term items
  createdAt: string;
  updatedAt: string;
}

// Memory scopes
export const MEMORY_SCOPES = {
  SESSION: 'session',
  PREFERENCES: 'preferences',
  CATEGORIES: 'categories',
  CONVERSATION: 'conversation',
  ANALYSIS: 'analysis',
} as const;

// Create or update agent memory
export async function setAgentMemory(
  userId: string,
  scope: string,
  data: Partial<AgentMemory>,
  ttlDays?: number
): Promise<void> {
  const userKey = generateUserKey(userId);
  const scopeKey = generateScopeKey(scope);
  const now = new Date().toISOString();

  const record: AgentMemoryRecord = {
    userId: userKey,
    memoryScope: scopeKey,
    conversationHistory: data.conversationHistory,
    learnedPreferences: data.learnedPreferences,
    categoryMappings: data.categoryMappings,
    lastAnalysisDate: data.lastAnalysisDate?.toISOString(),
    sessionId: data.sessionId,
    ttl: ttlDays ? generateTTL(ttlDays) : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await withErrorHandling(async () => {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAMES.AGENT_MEMORY,
      Item: record,
    }));
  }, 'setAgentMemory');
}

// Get agent memory by scope
export async function getAgentMemory(userId: string, scope: string): Promise<AgentMemory | null> {
  const userKey = generateUserKey(userId);
  const scopeKey = generateScopeKey(scope);

  const result = await withErrorHandling(async () => {
    return await docClient.send(new GetCommand({
      TableName: TABLE_NAMES.AGENT_MEMORY,
      Key: {
        userId: userKey,
        memoryScope: scopeKey,
      },
    }));
  }, 'getAgentMemory');

  if (!result.Item) {
    return null;
  }

  return recordToAgentMemory(result.Item as AgentMemoryRecord);
}

// Get all memory scopes for a user
export async function getAllAgentMemory(userId: string): Promise<Record<string, AgentMemory>> {
  const userKey = generateUserKey(userId);

  const result = await withErrorHandling(async () => {
    return await docClient.send(new QueryCommand({
      TableName: TABLE_NAMES.AGENT_MEMORY,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userKey,
      },
    }));
  }, 'getAllAgentMemory');

  const memoryMap: Record<string, AgentMemory> = {};
  
  (result.Items || []).forEach(item => {
    const record = item as AgentMemoryRecord;
    const scope = record.memoryScope.replace('SCOPE#', '');
    memoryMap[scope] = recordToAgentMemory(record);
  });

  return memoryMap;
}

// Update agent memory
export async function updateAgentMemory(
  userId: string,
  scope: string,
  updates: Partial<AgentMemory>,
  ttlDays?: number
): Promise<void> {
  const userKey = generateUserKey(userId);
  const scopeKey = generateScopeKey(scope);
  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && key !== 'userId') {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      
      // Handle date conversion
      if (key === 'lastAnalysisDate' && value instanceof Date) {
        expressionAttributeValues[attrValue] = value.toISOString();
      } else {
        expressionAttributeValues[attrValue] = value;
      }
    }
  });

  if (updateExpressions.length === 0) {
    return; // Nothing to update
  }

  // Always update the updatedAt timestamp
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = now;

  // Add TTL if specified
  if (ttlDays) {
    updateExpressions.push('#ttl = :ttl');
    expressionAttributeNames['#ttl'] = 'ttl';
    expressionAttributeValues[':ttl'] = generateTTL(ttlDays);
  }

  await withErrorHandling(async () => {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAMES.AGENT_MEMORY,
      Key: {
        userId: userKey,
        memoryScope: scopeKey,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }));
  }, 'updateAgentMemory');
}

// Delete agent memory
export async function deleteAgentMemory(userId: string, scope: string): Promise<void> {
  const userKey = generateUserKey(userId);
  const scopeKey = generateScopeKey(scope);

  await withErrorHandling(async () => {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAMES.AGENT_MEMORY,
      Key: {
        userId: userKey,
        memoryScope: scopeKey,
      },
    }));
  }, 'deleteAgentMemory');
}

// Convenience methods for specific memory types

// Session memory (short-term, with TTL)
export async function setSessionMemory(userId: string, sessionId: string, data: Partial<AgentMemory>): Promise<void> {
  await setAgentMemory(userId, MEMORY_SCOPES.SESSION, { ...data, sessionId }, 1); // 1 day TTL
}

export async function getSessionMemory(userId: string): Promise<AgentMemory | null> {
  return await getAgentMemory(userId, MEMORY_SCOPES.SESSION);
}

// Preferences memory (long-term)
export async function setPreferencesMemory(userId: string, preferences: UserPreference[]): Promise<void> {
  await setAgentMemory(userId, MEMORY_SCOPES.PREFERENCES, { learnedPreferences: preferences });
}

export async function getPreferencesMemory(userId: string): Promise<UserPreference[]> {
  const memory = await getAgentMemory(userId, MEMORY_SCOPES.PREFERENCES);
  return memory?.learnedPreferences || [];
}

// Category mappings memory (long-term)
export async function setCategoryMappings(userId: string, mappings: CategoryMapping[]): Promise<void> {
  await setAgentMemory(userId, MEMORY_SCOPES.CATEGORIES, { categoryMappings: mappings });
}

export async function getCategoryMappings(userId: string): Promise<CategoryMapping[]> {
  const memory = await getAgentMemory(userId, MEMORY_SCOPES.CATEGORIES);
  return memory?.categoryMappings || [];
}

// Conversation history (medium-term, with TTL)
export async function addConversationTurn(userId: string, turn: ConversationTurn): Promise<void> {
  const existing = await getAgentMemory(userId, MEMORY_SCOPES.CONVERSATION);
  const history = existing?.conversationHistory || [];
  
  // Keep only last 50 turns to prevent memory bloat
  const updatedHistory = [...history, turn].slice(-50);
  
  await setAgentMemory(userId, MEMORY_SCOPES.CONVERSATION, { conversationHistory: updatedHistory }, 7); // 7 days TTL
}

export async function getConversationHistory(userId: string): Promise<ConversationTurn[]> {
  const memory = await getAgentMemory(userId, MEMORY_SCOPES.CONVERSATION);
  return memory?.conversationHistory || [];
}

// Analysis tracking
export async function setLastAnalysisDate(userId: string, date: Date): Promise<void> {
  await setAgentMemory(userId, MEMORY_SCOPES.ANALYSIS, { lastAnalysisDate: date });
}

export async function getLastAnalysisDate(userId: string): Promise<Date | null> {
  const memory = await getAgentMemory(userId, MEMORY_SCOPES.ANALYSIS);
  return memory?.lastAnalysisDate || null;
}

// Helper function to convert DynamoDB record to AgentMemory
function recordToAgentMemory(record: AgentMemoryRecord): AgentMemory {
  return {
    userId: record.userId.replace('USER#', ''),
    conversationHistory: record.conversationHistory || [],
    learnedPreferences: record.learnedPreferences || [],
    categoryMappings: record.categoryMappings || [],
    lastAnalysisDate: record.lastAnalysisDate ? new Date(record.lastAnalysisDate) : new Date(),
    sessionId: record.sessionId || '',
  };
}