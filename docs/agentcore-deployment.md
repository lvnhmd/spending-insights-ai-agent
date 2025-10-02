# AgentCore Deployment Instructions

## Prerequisites
1. AWS CLI configured with appropriate permissions
2. Lambda functions deployed and working
3. Bedrock model access approved (Claude 3.5 Sonnet)

## Step 1: Create Bedrock Agent
1. Go to AWS Console → Bedrock → Agents
2. Click "Create Agent"
3. Use configuration from `infra/agent/agent-config.json`
4. Set foundation model to: `anthropic.claude-3-5-sonnet-20241022-v2:0`

## Step 2: Configure Action Groups
1. In the agent, go to "Action Groups"
2. Click "Add Action Group"
3. Name: "financial-analysis-tools"
4. Upload `infra/agent/action-group-schema.json` as OpenAPI schema
5. Set Lambda function ARN to your transaction-processor function

## Step 3: Enable Memory Management
1. In agent settings, enable "Session Summary" memory
2. Set storage duration to 30 days
3. Configure memory scope for user preferences

## Step 4: Test Agent
1. Create agent alias (e.g., "production")
2. Test with simple query: "Analyze my spending patterns"
3. Verify tool calls are working correctly

## Step 5: Integration Testing
1. Test full workflow: CSV upload → analysis → recommendations
2. Verify memory persistence across sessions
3. Test autonomous triggers via EventBridge

## Troubleshooting
- Check Lambda function permissions for Bedrock access
- Verify OpenAPI schema matches Lambda function signatures
- Test individual tools before full agent integration
- Monitor CloudWatch logs for debugging

## Success Criteria
- Agent can call all 5 tools successfully
- Memory management works across sessions
- Autonomous weekly analysis triggers correctly
- Tool orchestration follows logical sequence
