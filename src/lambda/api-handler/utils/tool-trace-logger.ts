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
}

// Export singleton instance
export const toolTraceLogger = new ToolTraceLogger();