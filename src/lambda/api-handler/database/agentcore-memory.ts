/**
 * AgentCore Memory Management Service
 * Requirements: 7.2, 7.3, 8.6
 * 
 * Implements Bedrock AgentCore Memory Management primitive with:
 * - Session context persistence in DynamoDB
 * - User preferences and learning data management
 * - Memory persistence across agent sessions
 * - Hierarchical memory structure (session, preferences, conversation, analysis)
 */

import { 
  setAgentMemory, 
  getAgentMemory, 
  getAllAgentMemory, 
  updateAgentMemory,
  setSessionMemory,
  getSessionMemory,
  setPreferencesMemory,
  getPreferencesMemory,
  setCategoryMappings,
  getCategoryMappings,
  addConversationTurn,
  getConversationHistory,
  setLastAnalysisDate,
  getLastAnalysisDate,
  MEMORY_SCOPES
} from './agent-memory';
import { AgentMemory, ConversationTurn, UserPreference, CategoryMapping } from '../types';

export interface AgentCoreMemoryContext {
  userId: string;
  sessionId: string;
  conversationId?: string;
  memoryScope: 'session' | 'short_term' | 'long_term';
}

export interface AgentCoreMemoryEntry {
  key: string;
  value: any;
  ttl?: number;
  metadata?: {
    source: string;
    confidence: number;
    lastUpdated: string;
    tags?: string[];
  };
}

export interface ToolExecutionContext {
  toolName: string;
  input: any;
  output: any;
  executionTime: number;
  success: boolean;
  reasoning?: string;
}

export interface AgentCoreSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  toolExecutions: ToolExecutionContext[];
  conversationTurns: ConversationTurn[];
  memoryEntries: AgentCoreMemoryEntry[];
  status: 'active' | 'completed' | 'error';
}

/**
 * AgentCore Memory Manager
 * Provides high-level memory management for Bedrock AgentCore integration
 */
export class AgentCoreMemoryManager {
  
  /**
   * Initialize a new agent session with memory context
   */
  async initializeSession(context: AgentCoreMemoryContext): Promise<AgentCoreSession> {
    const session: AgentCoreSession = {
      sessionId: context.sessionId,
      userId: context.userId,
      startTime: new Date(),
      lastActivity: new Date(),
      toolExecutions: [],
      conversationTurns: [],
      memoryEntries: [],
      status: 'active'
    };

    // Load existing memory context
    const existingMemory = await getAllAgentMemory(context.userId);
    
    // Convert existing memory to AgentCore format
    session.memoryEntries = this.convertToAgentCoreFormat(existingMemory);

    // Store session in memory
    await setSessionMemory(context.userId, context.sessionId, {
      userId: context.userId,
      sessionId: context.sessionId,
      conversationHistory: [],
      learnedPreferences: [],
      categoryMappings: [],
      lastAnalysisDate: new Date()
    });

    return session;
  }

  /**
   * Store memory entry with AgentCore context
   */
  async storeMemory(
    context: AgentCoreMemoryContext,
    key: string,
    value: any,
    metadata?: AgentCoreMemoryEntry['metadata']
  ): Promise<void> {
    const memoryEntry: AgentCoreMemoryEntry = {
      key,
      value,
      metadata: {
        source: 'agentcore',
        confidence: metadata?.confidence || 1.0,
        lastUpdated: new Date().toISOString(),
        tags: metadata?.tags || [],
        ...metadata
      }
    };

    // Determine storage scope based on memory type
    const scope = this.determineMemoryScope(key, context.memoryScope);
    
    // Store in appropriate memory scope
    switch (scope) {
      case 'session':
        await this.storeSessionMemory(context.userId, key, value, metadata);
        break;
      case 'preferences':
        await this.storePreferencesMemory(context.userId, key, value, metadata);
        break;
      case 'categories':
        await this.storeCategoryMemory(context.userId, key, value, metadata);
        break;
      case 'conversation':
        await this.storeConversationMemory(context.userId, key, value, metadata);
        break;
      default:
        await setAgentMemory(context.userId, scope, { [key]: value });
    }
  }

  /**
   * Retrieve memory entry by key
   */
  async retrieveMemory(
    context: AgentCoreMemoryContext,
    key: string
  ): Promise<AgentCoreMemoryEntry | null> {
    // Search across all memory scopes
    const allMemory = await getAllAgentMemory(context.userId);
    
    for (const [scope, memory] of Object.entries(allMemory)) {
      if (memory && typeof memory === 'object' && key in memory) {
        return {
          key,
          value: (memory as any)[key],
          metadata: {
            source: 'agentcore',
            confidence: 1.0,
            lastUpdated: new Date().toISOString(),
            tags: [scope]
          }
        };
      }
    }

    return null;
  }

  /**
   * Record tool execution for memory and learning
   */
  async recordToolExecution(
    context: AgentCoreMemoryContext,
    toolExecution: ToolExecutionContext
  ): Promise<void> {
    // Store tool execution in conversation history
    const conversationTurn: ConversationTurn = {
      id: `tool-${Date.now()}`,
      type: 'tool_execution',
      timestamp: new Date(),
      content: {
        tool: toolExecution.toolName,
        input: toolExecution.input,
        output: toolExecution.output,
        success: toolExecution.success,
        executionTime: toolExecution.executionTime,
        reasoning: toolExecution.reasoning
      },
      metadata: {
        sessionId: context.sessionId,
        source: 'agentcore'
      }
    };

    await addConversationTurn(context.userId, conversationTurn);

    // Learn from successful tool executions
    if (toolExecution.success) {
      await this.learnFromToolExecution(context.userId, toolExecution);
    }
  }

  /**
   * Get memory summary for AgentCore context
   */
  async getMemorySummary(context: AgentCoreMemoryContext): Promise<{
    sessionMemory: any;
    preferences: UserPreference[];
    categoryMappings: CategoryMapping[];
    recentConversations: ConversationTurn[];
    lastAnalysis: Date | null;
  }> {
    const [sessionMemory, preferences, categoryMappings, conversations, lastAnalysis] = await Promise.all([
      getSessionMemory(context.userId),
      getPreferencesMemory(context.userId),
      getCategoryMappings(context.userId),
      getConversationHistory(context.userId),
      getLastAnalysisDate(context.userId)
    ]);

    return {
      sessionMemory,
      preferences,
      categoryMappings,
      recentConversations: conversations.slice(-10), // Last 10 conversations
      lastAnalysis
    };
  }

  /**
   * Update user preferences based on agent interactions
   */
  async updatePreferencesFromInteraction(
    userId: string,
    interaction: {
      type: 'category_correction' | 'recommendation_feedback' | 'goal_update';
      data: any;
    }
  ): Promise<void> {
    const currentPreferences = await getPreferencesMemory(userId);

    switch (interaction.type) {
      case 'category_correction':
        await this.updateCategoryPreferences(userId, interaction.data, currentPreferences);
        break;
      case 'recommendation_feedback':
        await this.updateRecommendationPreferences(userId, interaction.data, currentPreferences);
        break;
      case 'goal_update':
        await this.updateGoalPreferences(userId, interaction.data, currentPreferences);
        break;
    }
  }

  /**
   * Clean up expired memory entries
   */
  async cleanupExpiredMemory(userId: string): Promise<void> {
    // This is handled automatically by DynamoDB TTL for session memory
    // Long-term memory (preferences, categories) doesn't expire
    console.log(`Memory cleanup completed for user ${userId}`);
  }

  // Private helper methods

  private determineMemoryScope(key: string, defaultScope: string): string {
    if (key.startsWith('session_')) return MEMORY_SCOPES.SESSION;
    if (key.startsWith('pref_')) return MEMORY_SCOPES.PREFERENCES;
    if (key.startsWith('category_')) return MEMORY_SCOPES.CATEGORIES;
    if (key.startsWith('conversation_')) return MEMORY_SCOPES.CONVERSATION;
    return defaultScope;
  }

  private async storeSessionMemory(
    userId: string,
    key: string,
    value: any,
    metadata?: AgentCoreMemoryEntry['metadata']
  ): Promise<void> {
    const sessionMemory = await getSessionMemory(userId) || {
      userId,
      sessionId: '',
      conversationHistory: [],
      learnedPreferences: [],
      categoryMappings: [],
      lastAnalysisDate: new Date()
    };

    // Add to session memory
    (sessionMemory as any)[key] = value;

    await setSessionMemory(userId, sessionMemory.sessionId, sessionMemory);
  }

  private async storePreferencesMemory(
    userId: string,
    key: string,
    value: any,
    metadata?: AgentCoreMemoryEntry['metadata']
  ): Promise<void> {
    const preferences = await getPreferencesMemory(userId);
    
    const newPreference: UserPreference = {
      id: key,
      type: 'general',
      value: value,
      confidence: metadata?.confidence || 1.0,
      source: metadata?.source || 'agentcore',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedPreferences = [...preferences.filter(p => p.id !== key), newPreference];
    await setPreferencesMemory(userId, updatedPreferences);
  }

  private async storeCategoryMemory(
    userId: string,
    key: string,
    value: any,
    metadata?: AgentCoreMemoryEntry['metadata']
  ): Promise<void> {
    const mappings = await getCategoryMappings(userId);
    
    const newMapping: CategoryMapping = {
      id: key,
      pattern: value.pattern || '',
      category: value.category || '',
      subcategory: value.subcategory,
      confidence: metadata?.confidence || 1.0,
      source: metadata?.source || 'agentcore',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedMappings = [...mappings.filter(m => m.id !== key), newMapping];
    await setCategoryMappings(userId, updatedMappings);
  }

  private async storeConversationMemory(
    userId: string,
    key: string,
    value: any,
    metadata?: AgentCoreMemoryEntry['metadata']
  ): Promise<void> {
    const conversationTurn: ConversationTurn = {
      id: key,
      type: 'memory_entry',
      timestamp: new Date(),
      content: value,
      metadata: {
        source: metadata?.source || 'agentcore',
        confidence: metadata?.confidence || 1.0
      }
    };

    await addConversationTurn(userId, conversationTurn);
  }

  private convertToAgentCoreFormat(memory: Record<string, AgentMemory>): AgentCoreMemoryEntry[] {
    const entries: AgentCoreMemoryEntry[] = [];

    Object.entries(memory).forEach(([scope, memoryData]) => {
      if (memoryData) {
        // Convert preferences
        memoryData.learnedPreferences?.forEach(pref => {
          entries.push({
            key: `pref_${pref.id}`,
            value: pref.value,
            metadata: {
              source: pref.source,
              confidence: pref.confidence,
              lastUpdated: pref.updatedAt.toISOString(),
              tags: [scope, 'preference']
            }
          });
        });

        // Convert category mappings
        memoryData.categoryMappings?.forEach(mapping => {
          entries.push({
            key: `category_${mapping.id}`,
            value: {
              pattern: mapping.pattern,
              category: mapping.category,
              subcategory: mapping.subcategory
            },
            metadata: {
              source: mapping.source,
              confidence: mapping.confidence,
              lastUpdated: mapping.updatedAt.toISOString(),
              tags: [scope, 'category']
            }
          });
        });
      }
    });

    return entries;
  }

  private async learnFromToolExecution(
    userId: string,
    toolExecution: ToolExecutionContext
  ): Promise<void> {
    // Learn category patterns from categorization tool
    if (toolExecution.toolName === 'categorize_transactions' && toolExecution.success) {
      await this.learnCategoryPatterns(userId, toolExecution);
    }

    // Learn user preferences from recommendation feedback
    if (toolExecution.toolName === 'generate_savings_recommendations' && toolExecution.success) {
      await this.learnRecommendationPreferences(userId, toolExecution);
    }
  }

  private async learnCategoryPatterns(
    userId: string,
    toolExecution: ToolExecutionContext
  ): Promise<void> {
    const { input, output } = toolExecution;
    
    if (output.categorizedTransactions) {
      const mappings = await getCategoryMappings(userId);
      
      for (const transaction of output.categorizedTransactions) {
        if (transaction.confidence > 0.8) { // Only learn from high-confidence categorizations
          const pattern = this.extractPattern(transaction);
          const existingMapping = mappings.find(m => m.pattern === pattern);
          
          if (!existingMapping) {
            const newMapping: CategoryMapping = {
              id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              pattern,
              category: transaction.category,
              subcategory: transaction.subcategory,
              confidence: transaction.confidence,
              source: 'agentcore_learning',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            mappings.push(newMapping);
          }
        }
      }
      
      await setCategoryMappings(userId, mappings);
    }
  }

  private async learnRecommendationPreferences(
    userId: string,
    toolExecution: ToolExecutionContext
  ): Promise<void> {
    // This would analyze which types of recommendations the user responds to
    // and adjust future recommendation generation accordingly
    const preferences = await getPreferencesMemory(userId);
    
    // Add preference learning logic here based on recommendation feedback
    // For now, just track that recommendations were generated
    const newPreference: UserPreference = {
      id: `rec_pref_${Date.now()}`,
      type: 'recommendation_style',
      value: {
        lastRecommendationTime: new Date(),
        recommendationCount: toolExecution.output.recommendations?.length || 0
      },
      confidence: 0.8,
      source: 'agentcore_learning',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await setPreferencesMemory(userId, [...preferences, newPreference]);
  }

  private extractPattern(transaction: any): string {
    // Extract a pattern from transaction description for category learning
    const description = transaction.description || '';
    
    // Simple pattern extraction - in production this would be more sophisticated
    const words = description.toLowerCase().split(/\s+/);
    const significantWords = words.filter(word => 
      word.length > 3 && 
      !['the', 'and', 'for', 'with', 'from'].includes(word)
    );
    
    return significantWords.slice(0, 2).join(' ');
  }

  private async updateCategoryPreferences(
    userId: string,
    data: any,
    currentPreferences: UserPreference[]
  ): Promise<void> {
    // Update category preferences based on user corrections
    const preference: UserPreference = {
      id: `category_correction_${Date.now()}`,
      type: 'category_preference',
      value: data,
      confidence: 1.0, // User corrections have high confidence
      source: 'user_correction',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setPreferencesMemory(userId, [...currentPreferences, preference]);
  }

  private async updateRecommendationPreferences(
    userId: string,
    data: any,
    currentPreferences: UserPreference[]
  ): Promise<void> {
    // Update recommendation preferences based on user feedback
    const preference: UserPreference = {
      id: `rec_feedback_${Date.now()}`,
      type: 'recommendation_feedback',
      value: data,
      confidence: 0.9,
      source: 'user_feedback',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setPreferencesMemory(userId, [...currentPreferences, preference]);
  }

  private async updateGoalPreferences(
    userId: string,
    data: any,
    currentPreferences: UserPreference[]
  ): Promise<void> {
    // Update goal preferences based on user input
    const preference: UserPreference = {
      id: `goal_update_${Date.now()}`,
      type: 'financial_goal',
      value: data,
      confidence: 1.0,
      source: 'user_input',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setPreferencesMemory(userId, [...currentPreferences, preference]);
  }
}

// Export singleton instance
export const agentCoreMemoryManager = new AgentCoreMemoryManager();