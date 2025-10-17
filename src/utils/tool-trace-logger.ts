/**
 * Tool Call Trace Logger
 * Requirements: 7.2, 7.3, 7.5, 8.6
 * 
 * Creates tool call trace logging for demo documentation
 * Logs structured decisions and tool orchestration for AgentCore
 */

export interface ToolCallTrace {
  traceId: string;
  sessionId: string;
  userId: string;
  timestamp: Date;
  toolName: string;
  input: any;
  output: any;
  executionTime: number;
  success: boolean;
  reasoning?: string;
  orchestrationStep: number;
  parentTraceId?: string;
  metadata: {
    agentVersion: string;
    modelUsed: string;
    confidence: number;
    memoryAccessed: string[];
    memoryUpdated: string[];
  };
}

export interface ToolOrchestrationTrace {
  orchestrationId: string;
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  totalExecutionTime?: number;
  toolSequence: string[];
  toolTraces: ToolCallTrace[];
  finalOutput: any;
  success: boolean;
  reasoning: string;
  memorySnapshot: {
    before: any;
    after: any;
  };
}

export class ToolTraceLogger {
  private traces: Map<string, ToolCallTrace> = new Map();
  private orchestrations: Map<string, ToolOrchestrationTrace> = new Map();

  /**
   * Start a new tool orchestration trace
   */
  startOrchestration(
    orchestrationId: string,
    sessionId: string,
    userId: string,
    toolSequence: string[],
    memorySnapshot: any
  ): ToolOrchestrationTrace {
    const orchestration: ToolOrchestrationTrace = {
      orchestrationId,
      sessionId,
      userId,
      startTime: new Date(),
      toolSequence,
      toolTraces: [],
      finalOutput: null,
      success: false,
      reasoning: '',
      memorySnapshot: {
        before: memorySnapshot,
        after: null
      }
    };

    this.orchestrations.set(orchestrationId, orchestration);
    
    console.log(`🎬 Started orchestration: ${orchestrationId}`);
    console.log(`   Tools: ${toolSequence.join(' → ')}`);
    
    return orchestration;
  }

  /**
   * Log a tool call within an orchestration
   */
  logToolCall(
    orchestrationId: string,
    toolName: string,
    input: any,
    output: any,
    executionTime: number,
    success: boolean,
    reasoning?: string,
    metadata?: Partial<ToolCallTrace['metadata']>
  ): ToolCallTrace {
    const orchestration = this.orchestrations.get(orchestrationId);
    if (!orchestration) {
      throw new Error(`Orchestration ${orchestrationId} not found`);
    }

    const traceId = `${orchestrationId}-${toolName}-${Date.now()}`;
    const orchestrationStep = orchestration.toolTraces.length + 1;

    const trace: ToolCallTrace = {
      traceId,
      sessionId: orchestration.sessionId,
      userId: orchestration.userId,
      timestamp: new Date(),
      toolName,
      input,
      output,
      executionTime,
      success,
      reasoning,
      orchestrationStep,
      parentTraceId: orchestrationId,
      metadata: {
        agentVersion: '1.0.0',
        modelUsed: 'claude-3-5-sonnet',
        confidence: 0.8,
        memoryAccessed: [],
        memoryUpdated: [],
        ...metadata
      }
    };

    this.traces.set(traceId, trace);
    orchestration.toolTraces.push(trace);

    console.log(`🔧 Tool call logged: ${toolName}`);
    console.log(`   Step: ${orchestrationStep}/${orchestration.toolSequence.length}`);
    console.log(`   Success: ${success}`);
    console.log(`   Time: ${executionTime}ms`);
    if (reasoning) {
      console.log(`   Reasoning: ${reasoning}`);
    }

    return trace;
  }

  /**
   * Complete an orchestration trace
   */
  completeOrchestration(
    orchestrationId: string,
    finalOutput: any,
    success: boolean,
    reasoning: string,
    memorySnapshotAfter: any
  ): ToolOrchestrationTrace {
    const orchestration = this.orchestrations.get(orchestrationId);
    if (!orchestration) {
      throw new Error(`Orchestration ${orchestrationId} not found`);
    }

    orchestration.endTime = new Date();
    orchestration.totalExecutionTime = orchestration.endTime.getTime() - orchestration.startTime.getTime();
    orchestration.finalOutput = finalOutput;
    orchestration.success = success;
    orchestration.reasoning = reasoning;
    orchestration.memorySnapshot.after = memorySnapshotAfter;

    console.log(`🎯 Orchestration completed: ${orchestrationId}`);
    console.log(`   Success: ${success}`);
    console.log(`   Total time: ${orchestration.totalExecutionTime}ms`);
    console.log(`   Tools executed: ${orchestration.toolTraces.length}`);

    return orchestration;
  }

  /**
   * Get orchestration trace for demo documentation
   */
  getOrchestrationTrace(orchestrationId: string): ToolOrchestrationTrace | null {
    return this.orchestrations.get(orchestrationId) || null;
  }

  /**
   * Get all traces for a session (for demo)
   */
  getSessionTraces(sessionId: string): ToolOrchestrationTrace[] {
    return Array.from(this.orchestrations.values())
      .filter(orchestration => orchestration.sessionId === sessionId);
  }

  /**
   * Export traces for demo documentation
   */
  exportTracesForDemo(sessionId?: string): {
    orchestrations: ToolOrchestrationTrace[];
    summary: {
      totalOrchestrations: number;
      totalToolCalls: number;
      averageExecutionTime: number;
      successRate: number;
      toolUsageStats: Record<string, number>;
    };
  } {
    const orchestrations = sessionId 
      ? this.getSessionTraces(sessionId)
      : Array.from(this.orchestrations.values());

    const allTraces = orchestrations.flatMap(o => o.toolTraces);
    
    const summary = {
      totalOrchestrations: orchestrations.length,
      totalToolCalls: allTraces.length,
      averageExecutionTime: allTraces.length > 0 
        ? allTraces.reduce((sum, t) => sum + t.executionTime, 0) / allTraces.length 
        : 0,
      successRate: allTraces.length > 0 
        ? allTraces.filter(t => t.success).length / allTraces.length 
        : 0,
      toolUsageStats: allTraces.reduce((stats, trace) => {
        stats[trace.toolName] = (stats[trace.toolName] || 0) + 1;
        return stats;
      }, {} as Record<string, number>)
    };

    return { orchestrations, summary };
  }

  /**
   * Generate demo-friendly trace visualization
   */
  generateTraceVisualization(orchestrationId: string): string {
    const orchestration = this.orchestrations.get(orchestrationId);
    if (!orchestration) {
      return 'Orchestration not found';
    }

    let visualization = `
🎬 Orchestration: ${orchestrationId}
📅 Started: ${orchestration.startTime.toISOString()}
👤 User: ${orchestration.userId}
🔄 Session: ${orchestration.sessionId}

📋 Planned Sequence: ${orchestration.toolSequence.join(' → ')}

🔧 Tool Execution Trace:
`;

    orchestration.toolTraces.forEach((trace, index) => {
      const status = trace.success ? '✅' : '❌';
      const step = `${index + 1}/${orchestration.toolTraces.length}`;
      
      visualization += `
${status} Step ${step}: ${trace.toolName}
   ⏱️  Execution time: ${trace.executionTime}ms
   🎯 Confidence: ${(trace.metadata.confidence * 100).toFixed(1)}%
   💭 Reasoning: ${trace.reasoning || 'No reasoning provided'}
   📥 Input: ${JSON.stringify(trace.input, null, 2).substring(0, 100)}...
   📤 Output: ${JSON.stringify(trace.output, null, 2).substring(0, 100)}...
`;

      if (trace.metadata.memoryAccessed.length > 0) {
        visualization += `   🧠 Memory accessed: ${trace.metadata.memoryAccessed.join(', ')}\n`;
      }
      
      if (trace.metadata.memoryUpdated.length > 0) {
        visualization += `   💾 Memory updated: ${trace.metadata.memoryUpdated.join(', ')}\n`;
      }
    });

    if (orchestration.endTime) {
      visualization += `
🎯 Final Result:
   ✅ Success: ${orchestration.success}
   ⏱️  Total time: ${orchestration.totalExecutionTime}ms
   💭 Final reasoning: ${orchestration.reasoning}
   📤 Final output: ${JSON.stringify(orchestration.finalOutput, null, 2).substring(0, 200)}...

📊 Memory Changes:
   📥 Before: ${Object.keys(orchestration.memorySnapshot.before || {}).length} entries
   📤 After: ${Object.keys(orchestration.memorySnapshot.after || {}).length} entries
`;
    }

    return visualization;
  }

  /**
   * Save traces to file for demo documentation
   */
  async saveTracesToFile(filePath: string, sessionId?: string): Promise<void> {
    const exportData = this.exportTracesForDemo(sessionId);
    
    const demoData = {
      generatedAt: new Date().toISOString(),
      sessionId,
      summary: exportData.summary,
      orchestrations: exportData.orchestrations.map(orchestration => ({
        ...orchestration,
        visualization: this.generateTraceVisualization(orchestration.orchestrationId)
      }))
    };

    // In a real implementation, this would write to a file
    // For now, we'll log it for demo purposes
    console.log('📄 Demo trace data generated:');
    console.log(JSON.stringify(demoData, null, 2));
    
    return Promise.resolve();
  }

  /**
   * Create a demo scenario trace
   */
  createDemoScenario(): string {
    const sessionId = `demo-session-${Date.now()}`;
    const userId = 'demo-user';
    const orchestrationId = `demo-orchestration-${Date.now()}`;

    // Start orchestration
    const memoryBefore = {
      preferences: ['weekly_insights: true', 'fee_alerts: true'],
      categories: ['grocery: Groceries', 'gas: Transportation'],
      lastAnalysis: '2024-01-01T00:00:00Z'
    };

    this.startOrchestration(
      orchestrationId,
      sessionId,
      userId,
      ['analyze_spending_patterns', 'categorize_transactions', 'detect_fees_and_subscriptions', 'generate_savings_recommendations'],
      memoryBefore
    );

    // Simulate tool calls
    this.logToolCall(
      orchestrationId,
      'analyze_spending_patterns',
      { userId, timeframe: 'month' },
      { 
        patterns: [
          { category: 'Groceries', trend: 'stable', averageAmount: 120.50, frequency: 8 },
          { category: 'Transportation', trend: 'increasing', averageAmount: 65.00, frequency: 12 }
        ],
        totalSpent: 1486.00,
        topCategories: ['Groceries', 'Transportation', 'Dining']
      },
      245,
      true,
      'Analyzed 45 transactions over month timeframe, identified stable grocery spending and increasing transportation costs',
      {
        confidence: 0.92,
        memoryAccessed: ['preferences', 'categories'],
        memoryUpdated: ['lastAnalysis']
      }
    );

    this.logToolCall(
      orchestrationId,
      'categorize_transactions',
      { 
        transactions: [
          { id: 'tx1', description: 'WHOLE FOODS MARKET', amount: 87.45 },
          { id: 'tx2', description: 'SHELL GAS STATION', amount: 42.30 }
        ]
      },
      {
        categorizedTransactions: [
          { transactionId: 'tx1', category: 'Groceries', subcategory: 'Food', confidence: 0.95 },
          { transactionId: 'tx2', category: 'Transportation', subcategory: 'Fuel', confidence: 0.88 }
        ]
      },
      156,
      true,
      'Successfully categorized 2 transactions using learned patterns and merchant recognition',
      {
        confidence: 0.91,
        memoryAccessed: ['categories'],
        memoryUpdated: ['categories']
      }
    );

    this.logToolCall(
      orchestrationId,
      'detect_fees_and_subscriptions',
      { 
        userId,
        transactions: [
          { id: 'tx3', description: 'NETFLIX SUBSCRIPTION', amount: 15.99, isRecurring: true },
          { id: 'tx4', description: 'BANK OVERDRAFT FEE', amount: 35.00, isRecurring: false }
        ]
      },
      {
        detectedFees: [
          { transactionId: 'tx3', type: 'subscription', annualCost: 191.88, cancellationDifficulty: 'easy' },
          { transactionId: 'tx4', type: 'bank_fee', annualCost: 420.00, cancellationDifficulty: 'medium' }
        ],
        totalAnnualCost: 611.88
      },
      189,
      true,
      'Detected 1 subscription and 1 bank fee with total annual impact of $611.88',
      {
        confidence: 0.87,
        memoryAccessed: ['preferences'],
        memoryUpdated: []
      }
    );

    this.logToolCall(
      orchestrationId,
      'generate_savings_recommendations',
      {
        userId,
        spendingPatterns: [
          { category: 'Transportation', amount: 780.00, frequency: 12 }
        ],
        detectedFees: [
          { type: 'bank_fee', amount: 35.00, description: 'Overdraft fee' }
        ]
      },
      {
        recommendations: [
          {
            id: 'rec1',
            title: 'Eliminate overdraft fees',
            description: 'Set up account alerts and maintain minimum balance',
            potentialSavings: 420.00,
            difficulty: 'easy',
            priority: 9,
            actionSteps: ['Enable account alerts', 'Set up automatic transfers', 'Monitor balance weekly']
          },
          {
            id: 'rec2',
            title: 'Optimize transportation spending',
            description: 'Consider carpooling or public transit for regular commutes',
            potentialSavings: 156.00,
            difficulty: 'medium',
            priority: 6,
            actionSteps: ['Research public transit options', 'Try carpooling apps', 'Plan efficient routes']
          }
        ],
        totalPotentialSavings: 576.00
      },
      298,
      true,
      'Generated 2 high-impact recommendations with total potential savings of $576/year',
      {
        confidence: 0.89,
        memoryAccessed: ['preferences'],
        memoryUpdated: ['preferences']
      }
    );

    // Complete orchestration
    const memoryAfter = {
      preferences: ['weekly_insights: true', 'fee_alerts: true', 'last_recommendations: 2'],
      categories: ['grocery: Groceries', 'gas: Transportation', 'whole_foods: Groceries'],
      lastAnalysis: new Date().toISOString()
    };

    this.completeOrchestration(
      orchestrationId,
      {
        insights: 'Generated comprehensive financial analysis',
        recommendations: 2,
        potentialSavings: 576.00,
        nextSteps: ['Implement overdraft protection', 'Explore transportation alternatives']
      },
      true,
      'Successfully completed end-to-end financial analysis with actionable recommendations',
      memoryAfter
    );

    return this.generateTraceVisualization(orchestrationId);
  }
}

// Export singleton instance
export const toolTraceLogger = new ToolTraceLogger();