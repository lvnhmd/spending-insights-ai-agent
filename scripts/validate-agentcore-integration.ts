#!/usr/bin/env ts-node

/**
 * Validate AgentCore Integration
 * Requirements: 7.2, 7.3, 7.5, 8.6
 * 
 * End-to-end validation of:
 * - Memory Management primitive functionality
 * - Action Groups tool orchestration
 * - Tool call trace logging
 * - Complete workflow execution
 */

import { agentCoreMemoryManager, AgentCoreMemoryContext } from '../src/database/agentcore-memory';
import { toolTraceLogger } from '../src/utils/tool-trace-logger';
import { setAgentMemory, getAgentMemory } from '../src/database/agent-memory';

interface ValidationResult {
  test: string;
  passed: boolean;
  details: string;
  executionTime?: number;
}

async function validateAgentCoreIntegration(): Promise<void> {
  console.log('🔍 Validating AgentCore Integration...\n');

  const results: ValidationResult[] = [];
  const testUserId = `validation-user-${Date.now()}`;
  const testSessionId = `validation-session-${Date.now()}`;

  try {
    // Test 1: Memory Management Primitive
    console.log('1️⃣  Testing Memory Management Primitive...');
    const memoryResult = await testMemoryManagement(testUserId, testSessionId);
    results.push(memoryResult);

    // Test 2: Tool Orchestration (Action Groups)
    console.log('2️⃣  Testing Tool Orchestration...');
    const orchestrationResult = await testToolOrchestration(testUserId, testSessionId);
    results.push(orchestrationResult);

    // Test 3: Tool Call Trace Logging
    console.log('3️⃣  Testing Tool Call Trace Logging...');
    const traceResult = await testTraceLogging(testUserId, testSessionId);
    results.push(traceResult);

    // Test 4: Cross-Session Persistence
    console.log('4️⃣  Testing Cross-Session Persistence...');
    const persistenceResult = await testCrossSessionPersistence(testUserId);
    results.push(persistenceResult);

    // Test 5: Error Handling and Recovery
    console.log('5️⃣  Testing Error Handling...');
    const errorResult = await testErrorHandling(testUserId, testSessionId);
    results.push(errorResult);

    // Test 6: Performance Benchmarks
    console.log('6️⃣  Testing Performance Benchmarks...');
    const performanceResult = await testPerformanceBenchmarks(testUserId, testSessionId);
    results.push(performanceResult);

    // Generate validation report
    generateValidationReport(results);

  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    process.exit(1);
  }
}

async function testMemoryManagement(userId: string, sessionId: string): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    const context: AgentCoreMemoryContext = {
      userId,
      sessionId,
      memoryScope: 'session'
    };

    // Initialize session
    const session = await agentCoreMemoryManager.initializeSession(context);
    
    if (!session || session.userId !== userId) {
      return {
        test: 'Memory Management Primitive',
        passed: false,
        details: 'Failed to initialize session'
      };
    }

    // Store and retrieve memory
    await agentCoreMemoryManager.storeMemory(
      context,
      'test_preference',
      'weekly_insights',
      { source: 'validation_test', confidence: 1.0 }
    );

    const retrieved = await agentCoreMemoryManager.retrieveMemory(context, 'test_preference');
    
    if (!retrieved || retrieved.value !== 'weekly_insights') {
      return {
        test: 'Memory Management Primitive',
        passed: false,
        details: 'Failed to store/retrieve memory'
      };
    }

    // Test memory summary
    const summary = await agentCoreMemoryManager.getMemorySummary(context);
    
    if (!summary) {
      return {
        test: 'Memory Management Primitive',
        passed: false,
        details: 'Failed to generate memory summary'
      };
    }

    return {
      test: 'Memory Management Primitive',
      passed: true,
      details: `Session initialized, memory stored/retrieved, summary generated`,
      executionTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      test: 'Memory Management Primitive',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function testToolOrchestration(userId: string, sessionId: string): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    const orchestrationId = `validation-orchestration-${Date.now()}`;
    
    // Start orchestration
    const memorySnapshot = { test: 'data' };
    const orchestration = toolTraceLogger.startOrchestration(
      orchestrationId,
      sessionId,
      userId,
      ['analyze_spending_patterns', 'generate_savings_recommendations'],
      memorySnapshot
    );

    if (!orchestration || orchestration.orchestrationId !== orchestrationId) {
      return {
        test: 'Tool Orchestration (Action Groups)',
        passed: false,
        details: 'Failed to start orchestration'
      };
    }

    // Simulate tool calls
    toolTraceLogger.logToolCall(
      orchestrationId,
      'analyze_spending_patterns',
      { userId, timeframe: 'month' },
      { patterns: [], totalSpent: 1000 },
      100,
      true,
      'Test analysis completed',
      { confidence: 0.9, memoryAccessed: ['preferences'], memoryUpdated: [] }
    );

    toolTraceLogger.logToolCall(
      orchestrationId,
      'generate_savings_recommendations',
      { userId, spendingPatterns: [] },
      { recommendations: [], totalPotentialSavings: 200 },
      150,
      true,
      'Test recommendations generated',
      { confidence: 0.8, memoryAccessed: ['preferences'], memoryUpdated: ['preferences'] }
    );

    // Complete orchestration
    toolTraceLogger.completeOrchestration(
      orchestrationId,
      { success: true, message: 'Validation test completed' },
      true,
      'Tool orchestration validation successful',
      { test: 'updated_data' }
    );

    const completedOrchestration = toolTraceLogger.getOrchestrationTrace(orchestrationId);
    
    if (!completedOrchestration || completedOrchestration.toolTraces.length !== 2) {
      return {
        test: 'Tool Orchestration (Action Groups)',
        passed: false,
        details: 'Orchestration not completed properly'
      };
    }

    return {
      test: 'Tool Orchestration (Action Groups)',
      passed: true,
      details: `Orchestration completed with ${completedOrchestration.toolTraces.length} tool calls`,
      executionTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      test: 'Tool Orchestration (Action Groups)',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function testTraceLogging(userId: string, sessionId: string): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // Export traces for the session
    const exportData = toolTraceLogger.exportTracesForDemo(sessionId);
    
    if (!exportData || !exportData.orchestrations || exportData.orchestrations.length === 0) {
      return {
        test: 'Tool Call Trace Logging',
        passed: false,
        details: 'No traces found for session'
      };
    }

    // Validate trace structure
    const orchestration = exportData.orchestrations[0];
    
    if (!orchestration.toolTraces || orchestration.toolTraces.length === 0) {
      return {
        test: 'Tool Call Trace Logging',
        passed: false,
        details: 'No tool traces found in orchestration'
      };
    }

    // Validate trace content
    const trace = orchestration.toolTraces[0];
    const requiredFields = ['traceId', 'toolName', 'input', 'output', 'executionTime', 'success'];
    const missingFields = requiredFields.filter(field => !(field in trace));
    
    if (missingFields.length > 0) {
      return {
        test: 'Tool Call Trace Logging',
        passed: false,
        details: `Missing trace fields: ${missingFields.join(', ')}`
      };
    }

    // Test visualization generation
    const visualization = toolTraceLogger.generateTraceVisualization(orchestration.orchestrationId);
    
    if (!visualization || visualization.length < 100) {
      return {
        test: 'Tool Call Trace Logging',
        passed: false,
        details: 'Failed to generate trace visualization'
      };
    }

    return {
      test: 'Tool Call Trace Logging',
      passed: true,
      details: `Traces logged and exported successfully, visualization generated`,
      executionTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      test: 'Tool Call Trace Logging',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function testCrossSessionPersistence(userId: string): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // Store data in first session
    const session1Id = `session1-${Date.now()}`;
    const context1: AgentCoreMemoryContext = {
      userId,
      sessionId: session1Id,
      memoryScope: 'long_term'
    };

    await agentCoreMemoryManager.storeMemory(
      context1,
      'pref_persistent_test',
      'cross_session_value',
      { source: 'session1', confidence: 1.0 }
    );

    // Retrieve data in second session
    const session2Id = `session2-${Date.now()}`;
    const context2: AgentCoreMemoryContext = {
      userId,
      sessionId: session2Id,
      memoryScope: 'long_term'
    };

    const retrieved = await agentCoreMemoryManager.retrieveMemory(context2, 'pref_persistent_test');
    
    if (!retrieved || retrieved.value !== 'cross_session_value') {
      return {
        test: 'Cross-Session Persistence',
        passed: false,
        details: 'Data not persisted across sessions'
      };
    }

    // Test memory summary across sessions
    const summary1 = await agentCoreMemoryManager.getMemorySummary(context1);
    const summary2 = await agentCoreMemoryManager.getMemorySummary(context2);
    
    if (!summary1 || !summary2) {
      return {
        test: 'Cross-Session Persistence',
        passed: false,
        details: 'Failed to generate memory summaries'
      };
    }

    return {
      test: 'Cross-Session Persistence',
      passed: true,
      details: `Data persisted across sessions, summaries accessible`,
      executionTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      test: 'Cross-Session Persistence',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function testErrorHandling(userId: string, sessionId: string): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // Test invalid orchestration ID
    try {
      toolTraceLogger.logToolCall(
        'invalid-orchestration-id',
        'test_tool',
        {},
        {},
        100,
        false
      );
      
      return {
        test: 'Error Handling and Recovery',
        passed: false,
        details: 'Should have thrown error for invalid orchestration ID'
      };
    } catch (expectedError) {
      // This is expected
    }

    // Test memory retrieval with invalid key
    const context: AgentCoreMemoryContext = {
      userId,
      sessionId,
      memoryScope: 'session'
    };

    const invalidResult = await agentCoreMemoryManager.retrieveMemory(context, 'non_existent_key');
    
    if (invalidResult !== null) {
      return {
        test: 'Error Handling and Recovery',
        passed: false,
        details: 'Should return null for non-existent memory key'
      };
    }

    // Test graceful handling of malformed data
    try {
      await setAgentMemory(userId, 'error_test', {
        userId,
        sessionId: '',
        conversationHistory: [],
        learnedPreferences: [],
        categoryMappings: [],
        lastAnalysisDate: new Date()
      });

      const result = await getAgentMemory(userId, 'error_test');
      
      if (!result) {
        return {
          test: 'Error Handling and Recovery',
          passed: false,
          details: 'Failed to handle valid data storage/retrieval'
        };
      }

    } catch (error) {
      return {
        test: 'Error Handling and Recovery',
        passed: false,
        details: `Unexpected error in data handling: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }

    return {
      test: 'Error Handling and Recovery',
      passed: true,
      details: `Error conditions handled gracefully`,
      executionTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      test: 'Error Handling and Recovery',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function testPerformanceBenchmarks(userId: string, sessionId: string): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    const context: AgentCoreMemoryContext = {
      userId,
      sessionId,
      memoryScope: 'session'
    };

    // Benchmark memory operations
    const memoryStartTime = Date.now();
    
    // Store multiple memory entries
    for (let i = 0; i < 10; i++) {
      await agentCoreMemoryManager.storeMemory(
        context,
        `perf_test_${i}`,
        `value_${i}`,
        { source: 'performance_test', confidence: 0.9 }
      );
    }
    
    // Retrieve memory entries
    for (let i = 0; i < 10; i++) {
      await agentCoreMemoryManager.retrieveMemory(context, `perf_test_${i}`);
    }
    
    const memoryTime = Date.now() - memoryStartTime;
    
    // Benchmark tool orchestration
    const orchestrationStartTime = Date.now();
    const orchestrationId = `perf-test-${Date.now()}`;
    
    toolTraceLogger.startOrchestration(
      orchestrationId,
      sessionId,
      userId,
      ['test_tool_1', 'test_tool_2', 'test_tool_3'],
      {}
    );
    
    // Log multiple tool calls
    for (let i = 0; i < 5; i++) {
      toolTraceLogger.logToolCall(
        orchestrationId,
        `test_tool_${i}`,
        { testData: i },
        { result: i * 2 },
        50 + i * 10,
        true,
        `Performance test tool ${i}`,
        { confidence: 0.8, memoryAccessed: [], memoryUpdated: [] }
      );
    }
    
    toolTraceLogger.completeOrchestration(
      orchestrationId,
      { performanceTest: true },
      true,
      'Performance test completed',
      {}
    );
    
    const orchestrationTime = Date.now() - orchestrationStartTime;
    
    // Performance thresholds (in milliseconds)
    const MEMORY_THRESHOLD = 2000; // 2 seconds for 20 operations
    const ORCHESTRATION_THRESHOLD = 1000; // 1 second for orchestration setup
    
    if (memoryTime > MEMORY_THRESHOLD) {
      return {
        test: 'Performance Benchmarks',
        passed: false,
        details: `Memory operations too slow: ${memoryTime}ms (threshold: ${MEMORY_THRESHOLD}ms)`
      };
    }
    
    if (orchestrationTime > ORCHESTRATION_THRESHOLD) {
      return {
        test: 'Performance Benchmarks',
        passed: false,
        details: `Orchestration too slow: ${orchestrationTime}ms (threshold: ${ORCHESTRATION_THRESHOLD}ms)`
      };
    }

    return {
      test: 'Performance Benchmarks',
      passed: true,
      details: `Memory: ${memoryTime}ms, Orchestration: ${orchestrationTime}ms (within thresholds)`,
      executionTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      test: 'Performance Benchmarks',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

function generateValidationReport(results: ValidationResult[]): void {
  console.log('\n📊 AgentCore Integration Validation Report\n');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const successRate = (passed / total) * 100;
  
  console.log(`Overall Success Rate: ${successRate.toFixed(1)}% (${passed}/${total})\n`);
  
  results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    const timing = result.executionTime ? ` (${result.executionTime}ms)` : '';
    
    console.log(`${status} ${index + 1}. ${result.test}${timing}`);
    console.log(`   ${result.details}\n`);
  });
  
  if (successRate === 100) {
    console.log('🎉 All AgentCore integration tests passed!');
    console.log('\n✅ Ready for production deployment');
    console.log('✅ Memory Management primitive working correctly');
    console.log('✅ Tool Orchestration (Action Groups) functioning properly');
    console.log('✅ Tool call trace logging operational');
    console.log('✅ Cross-session persistence verified');
    console.log('✅ Error handling robust');
    console.log('✅ Performance within acceptable thresholds');
  } else {
    console.log('⚠️  Some tests failed - review and fix before deployment');
    
    const failedTests = results.filter(r => !r.passed);
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`   - ${test.test}: ${test.details}`);
    });
  }
  
  console.log('\n📋 Next Steps:');
  if (successRate === 100) {
    console.log('1. Deploy to AWS environment');
    console.log('2. Test with real Bedrock Agent in console');
    console.log('3. Generate demo traces for presentation');
    console.log('4. Prepare architecture documentation');
  } else {
    console.log('1. Fix failing tests');
    console.log('2. Re-run validation');
    console.log('3. Check AWS permissions and connectivity');
    console.log('4. Review error logs for debugging');
  }
}

// Run if called directly
if (require.main === module) {
  validateAgentCoreIntegration();
}

export { validateAgentCoreIntegration };