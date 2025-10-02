# AgentCore Backup Plan

## If AgentCore Integration Fails

### Option 1: Direct Lambda Invocation
- Use API Gateway to expose Lambda functions as REST endpoints
- Implement tool coordination logic in the weekly-insights-generator Lambda
- Use Step Functions for complex multi-tool workflows

### Option 2: Step Functions Orchestration
Create Step Function state machine for tool coordination:

```json
{
  "Comment": "Financial Analysis Workflow",
  "StartAt": "AnalyzeSpending",
  "States": {
    "AnalyzeSpending": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:ACCOUNT:function:analyze-spending-patterns",
      "Next": "CategorizeTransactions"
    },
    "CategorizeTransactions": {
      "Type": "Task", 
      "Resource": "arn:aws:lambda:us-east-1:ACCOUNT:function:categorize-transactions",
      "Next": "DetectFees"
    },
    "DetectFees": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:ACCOUNT:function:detect-fees-and-subscriptions", 
      "Next": "GenerateRecommendations"
    },
    "GenerateRecommendations": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:ACCOUNT:function:generate-savings-recommendations",
      "End": true
    }
  }
}
```

### Demo Strategy:
- Show working Lambda functions with sample data
- Demonstrate tool coordination through Step Functions
- Explain how this architecture supports AgentCore integration
- Emphasize autonomous capability through EventBridge triggers

### Key Message for Judges:
"The architecture is designed for AgentCore integration, with fallback options that maintain autonomous operation and tool orchestration capabilities."
