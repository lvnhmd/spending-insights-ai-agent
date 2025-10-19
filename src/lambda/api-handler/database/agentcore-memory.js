"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentCoreMemoryManager = exports.AgentCoreMemoryManager = void 0;
const agent_memory_1 = require("./agent-memory");
/**
 * AgentCore Memory Manager
 * Provides high-level memory management for Bedrock AgentCore integration
 */
class AgentCoreMemoryManager {
    /**
     * Initialize a new agent session with memory context
     */
    async initializeSession(context) {
        const session = {
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
        const existingMemory = await (0, agent_memory_1.getAllAgentMemory)(context.userId);
        // Convert existing memory to AgentCore format
        session.memoryEntries = this.convertToAgentCoreFormat(existingMemory);
        // Store session in memory
        await (0, agent_memory_1.setSessionMemory)(context.userId, context.sessionId, {
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
    async storeMemory(context, key, value, metadata) {
        const memoryEntry = {
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
                await (0, agent_memory_1.setAgentMemory)(context.userId, scope, { [key]: value });
        }
    }
    /**
     * Retrieve memory entry by key
     */
    async retrieveMemory(context, key) {
        // Search across all memory scopes
        const allMemory = await (0, agent_memory_1.getAllAgentMemory)(context.userId);
        for (const [scope, memory] of Object.entries(allMemory)) {
            if (memory && typeof memory === 'object' && key in memory) {
                return {
                    key,
                    value: memory[key],
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
    async recordToolExecution(context, toolExecution) {
        // Store tool execution in conversation history
        const conversationTurn = {
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
        await (0, agent_memory_1.addConversationTurn)(context.userId, conversationTurn);
        // Learn from successful tool executions
        if (toolExecution.success) {
            await this.learnFromToolExecution(context.userId, toolExecution);
        }
    }
    /**
     * Get memory summary for AgentCore context
     */
    async getMemorySummary(context) {
        const [sessionMemory, preferences, categoryMappings, conversations, lastAnalysis] = await Promise.all([
            (0, agent_memory_1.getSessionMemory)(context.userId),
            (0, agent_memory_1.getPreferencesMemory)(context.userId),
            (0, agent_memory_1.getCategoryMappings)(context.userId),
            (0, agent_memory_1.getConversationHistory)(context.userId),
            (0, agent_memory_1.getLastAnalysisDate)(context.userId)
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
    async updatePreferencesFromInteraction(userId, interaction) {
        const currentPreferences = await (0, agent_memory_1.getPreferencesMemory)(userId);
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
    async cleanupExpiredMemory(userId) {
        // This is handled automatically by DynamoDB TTL for session memory
        // Long-term memory (preferences, categories) doesn't expire
        console.log(`Memory cleanup completed for user ${userId}`);
    }
    // Private helper methods
    determineMemoryScope(key, defaultScope) {
        if (key.startsWith('session_'))
            return agent_memory_1.MEMORY_SCOPES.SESSION;
        if (key.startsWith('pref_'))
            return agent_memory_1.MEMORY_SCOPES.PREFERENCES;
        if (key.startsWith('category_'))
            return agent_memory_1.MEMORY_SCOPES.CATEGORIES;
        if (key.startsWith('conversation_'))
            return agent_memory_1.MEMORY_SCOPES.CONVERSATION;
        return defaultScope;
    }
    async storeSessionMemory(userId, key, value, metadata) {
        const sessionMemory = await (0, agent_memory_1.getSessionMemory)(userId) || {
            userId,
            sessionId: '',
            conversationHistory: [],
            learnedPreferences: [],
            categoryMappings: [],
            lastAnalysisDate: new Date()
        };
        // Add to session memory
        sessionMemory[key] = value;
        await (0, agent_memory_1.setSessionMemory)(userId, sessionMemory.sessionId, sessionMemory);
    }
    async storePreferencesMemory(userId, key, value, metadata) {
        const preferences = await (0, agent_memory_1.getPreferencesMemory)(userId);
        const newPreference = {
            id: key,
            type: 'general',
            value: value,
            confidence: metadata?.confidence || 1.0,
            source: metadata?.source || 'agentcore',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const updatedPreferences = [...preferences.filter(p => p.id !== key), newPreference];
        await (0, agent_memory_1.setPreferencesMemory)(userId, updatedPreferences);
    }
    async storeCategoryMemory(userId, key, value, metadata) {
        const mappings = await (0, agent_memory_1.getCategoryMappings)(userId);
        const newMapping = {
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
        await (0, agent_memory_1.setCategoryMappings)(userId, updatedMappings);
    }
    async storeConversationMemory(userId, key, value, metadata) {
        const conversationTurn = {
            id: key,
            type: 'memory_entry',
            timestamp: new Date(),
            content: value,
            metadata: {
                source: metadata?.source || 'agentcore',
                confidence: metadata?.confidence || 1.0
            }
        };
        await (0, agent_memory_1.addConversationTurn)(userId, conversationTurn);
    }
    convertToAgentCoreFormat(memory) {
        const entries = [];
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
    async learnFromToolExecution(userId, toolExecution) {
        // Learn category patterns from categorization tool
        if (toolExecution.toolName === 'categorize_transactions' && toolExecution.success) {
            await this.learnCategoryPatterns(userId, toolExecution);
        }
        // Learn user preferences from recommendation feedback
        if (toolExecution.toolName === 'generate_savings_recommendations' && toolExecution.success) {
            await this.learnRecommendationPreferences(userId, toolExecution);
        }
    }
    async learnCategoryPatterns(userId, toolExecution) {
        const { input, output } = toolExecution;
        if (output.categorizedTransactions) {
            const mappings = await (0, agent_memory_1.getCategoryMappings)(userId);
            for (const transaction of output.categorizedTransactions) {
                if (transaction.confidence > 0.8) { // Only learn from high-confidence categorizations
                    const pattern = this.extractPattern(transaction);
                    const existingMapping = mappings.find(m => m.pattern === pattern);
                    if (!existingMapping) {
                        const newMapping = {
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
            await (0, agent_memory_1.setCategoryMappings)(userId, mappings);
        }
    }
    async learnRecommendationPreferences(userId, toolExecution) {
        // This would analyze which types of recommendations the user responds to
        // and adjust future recommendation generation accordingly
        const preferences = await (0, agent_memory_1.getPreferencesMemory)(userId);
        // Add preference learning logic here based on recommendation feedback
        // For now, just track that recommendations were generated
        const newPreference = {
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
        await (0, agent_memory_1.setPreferencesMemory)(userId, [...preferences, newPreference]);
    }
    extractPattern(transaction) {
        // Extract a pattern from transaction description for category learning
        const description = transaction.description || '';
        // Simple pattern extraction - in production this would be more sophisticated
        const words = description.toLowerCase().split(/\s+/);
        const significantWords = words.filter(word => word.length > 3 &&
            !['the', 'and', 'for', 'with', 'from'].includes(word));
        return significantWords.slice(0, 2).join(' ');
    }
    async updateCategoryPreferences(userId, data, currentPreferences) {
        // Update category preferences based on user corrections
        const preference = {
            id: `category_correction_${Date.now()}`,
            type: 'category_preference',
            value: data,
            confidence: 1.0, // User corrections have high confidence
            source: 'user_correction',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await (0, agent_memory_1.setPreferencesMemory)(userId, [...currentPreferences, preference]);
    }
    async updateRecommendationPreferences(userId, data, currentPreferences) {
        // Update recommendation preferences based on user feedback
        const preference = {
            id: `rec_feedback_${Date.now()}`,
            type: 'recommendation_feedback',
            value: data,
            confidence: 0.9,
            source: 'user_feedback',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await (0, agent_memory_1.setPreferencesMemory)(userId, [...currentPreferences, preference]);
    }
    async updateGoalPreferences(userId, data, currentPreferences) {
        // Update goal preferences based on user input
        const preference = {
            id: `goal_update_${Date.now()}`,
            type: 'financial_goal',
            value: data,
            confidence: 1.0,
            source: 'user_input',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await (0, agent_memory_1.setPreferencesMemory)(userId, [...currentPreferences, preference]);
    }
}
exports.AgentCoreMemoryManager = AgentCoreMemoryManager;
// Export singleton instance
exports.agentCoreMemoryManager = new AgentCoreMemoryManager();
