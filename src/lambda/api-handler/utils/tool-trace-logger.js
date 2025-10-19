"use strict";
/**
 * Tool Call Trace Logger
 * Requirements: 7.2, 7.3, 7.5, 8.6
 *
 * Creates tool call trace logging for demo documentation
 * Logs structured decisions and tool orchestration for AgentCore
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolTraceLogger = exports.ToolTraceLogger = void 0;
class ToolTraceLogger {
    constructor() {
        this.traces = new Map();
        this.orchestrations = new Map();
    }
    /**
     * Start a new tool orchestration trace
     */
    startOrchestration(orchestrationId, sessionId, userId, toolSequence, memorySnapshot) {
        const orchestration = {
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
    logToolCall(orchestrationId, toolName, input, output, executionTime, success, reasoning, metadata) {
        const orchestration = this.orchestrations.get(orchestrationId);
        if (!orchestration) {
            throw new Error(`Orchestration ${orchestrationId} not found`);
        }
        const traceId = `${orchestrationId}-${toolName}-${Date.now()}`;
        const orchestrationStep = orchestration.toolTraces.length + 1;
        const trace = {
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
    completeOrchestration(orchestrationId, finalOutput, success, reasoning, memorySnapshotAfter) {
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
    getOrchestrationTrace(orchestrationId) {
        return this.orchestrations.get(orchestrationId) || null;
    }
    /**
     * Get all traces for a session (for demo)
     */
    getSessionTraces(sessionId) {
        return Array.from(this.orchestrations.values())
            .filter(orchestration => orchestration.sessionId === sessionId);
    }
    /**
     * Export traces for demo documentation
     */
    exportTracesForDemo(sessionId) {
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
            }, {})
        };
        return { orchestrations, summary };
    }
    /**
     * Generate demo-friendly trace visualization
     */
    generateTraceVisualization(orchestrationId) {
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
exports.ToolTraceLogger = ToolTraceLogger;
// Export singleton instance
exports.toolTraceLogger = new ToolTraceLogger();
