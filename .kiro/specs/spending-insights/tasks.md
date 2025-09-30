# Implementation Plan

## Day 0: IMMEDIATE ACTION ITEMS (Do These NOW)

**🚨 CRITICAL: Complete these before starting Day 1**

- [x] 0.1 Request Bedrock model access (DO THIS FIRST - can take 24-48 hours)
  - Go to AWS Console → Bedrock → Model access
  - Request Claude 3.5 Sonnet, Claude 3 Haiku, and Amazon Nova (nova-lite/pro)
  - Monitor approval status daily
  - _Requirements: 7.1_

- [ ] 0.2 Verify AWS account setup and quotas
  - Activate AWS credit codes and confirm $100 credit applied
  - Check AWS Billing dashboard for credit status
  - Verify Bedrock TPS, Lambda concurrency (≥20), API Gateway burst limits
  - Check Bedrock service quotas (models per region, concurrent requests)
  - Verify S3, DynamoDB, EventBridge are available in your region
  - _Requirements: 8.1_

- [ ] 0.3 Prepare development environment and guardrails
  - Install AWS CDK, Node.js, TypeScript
  - Configure AWS CLI credentials
  - Test `cdk bootstrap` in development account
  - Clone AWS samples repository and study AgentCore examples
  - Create guardrails/policy.json with PII redaction and financial advice protection
  - Add 2-case unit test for guardrails in repository
  - _Requirements: 8.1_

## Week 1: Core Infrastructure (Must-Haves)

### Days 1-2: Foundation Setup

- [ ] 1. Set up CDK project structure with reproducible deployment
  - [ ] 1.1 Create GitHub repository and local structure
    - Create public GitHub repository: "spending-insights-ai-agent"
    - Set up local folder structure: /app, /infra, /infra/agent, /scripts, /guardrails, /docs, /cache
    - Initialize CDK project in /infra directory
    - Create basic package.json files and .gitignore
    - Create initial README.md with setup instructions
    - First commit: "Initial project structure"
    - _Requirements: 8.1_
  
  - [ ] 1.2 Configure AWS infrastructure with CDK
    - Configure DynamoDB tables with proper keys, S3 bucket, Lambda function skeletons
    - Set up least-privilege IAM: Lambda can only read s3://bucket/${env}/, DDB table ARNs, bedrock:InvokeModel
    - Create Makefile with deploy/destroy/seed commands for one-liner deployment
    - Deploy initial infrastructure and verify connectivity
    - Commit: "Initial AWS infrastructure setup"
    - _Requirements: 7.1, 7.6, 8.1_

### Days 3-4: Data Layer

- [ ] 2. Build CSV processing and data models
  - Create TypeScript interfaces for Transaction, WeeklyInsight, and Recommendation
  - Implement CSV parser with error handling for malformed data
  - Build transaction data sanitization with basic PII redaction
  - Write unit tests for CSV processing with sample data
  - _Requirements: 1.1, 1.2, 1.4, 6.2_

- [ ] 3. Create DynamoDB tables with optimized keys and basic operations
  - Create tables with proper keys:
    - transactions: pk=USER#${userId}, sk=DT#${yyyy-mm-dd}#TX#${txId}, GSI1 userWeekIdx: pk=USER#${userId}#W#${isoWeek}, sk=CAT#${category}
    - weekly-insights: pk=USER#${userId}, sk=W#${isoWeek}
    - agent-memory: pk=USER#${userId}, sk=SCOPE#${scope} with TTL for short-term items
    - user-profiles: pk=USER#${userId}, sk=PROFILE
  - Implement basic CRUD operations (no repository pattern, keep simple)
  - Set up DynamoDB client with error handling
  - Test data operations locally with sample data
  - _Requirements: 7.6, 8.1, 1.5_

### Days 5-7: Lambda Functions (Test Locally First)

- [ ] 4. Build core Lambda functions with mock data
  - [ ] 4.1 Create transaction-processor Lambda function with mock LLM path
    - Implement transaction categorization logic using Claude 3 Haiku
    - Build fee and subscription detection algorithms
    - Add basic pattern recognition for recurring charges
    - Gate Bedrock calls: if (process.env.MODEL_MODE === 'mock') return mockResponseForTests(input)
    - Test locally with sample CSV data (no AWS calls yet)
    - _Requirements: 1.2, 1.4, 3.1, 3.2, 7.3_

  - [ ] 4.2 Create weekly-insights-generator Lambda function
    - Implement spending pattern analysis and trend detection
    - Build recommendation generation with impact vs effort prioritization
    - Create post-hoc explanation generation for transparency
    - Add savings calculations and actionable step guidance
    - Test locally with mock transaction data
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.3, 8.6_

  - [ ] 4.3 Create api-handler Lambda function with health endpoints
    - Set Lambda timeout to 25 seconds (not 30s - leave buffer for API Gateway)
    - Build REST API endpoints for CSV upload and insights retrieval
    - Implement basic user session management
    - Add proper error handling and response formatting
    - Create health endpoints: GET /health (static), GET /readiness (200ms DDB+Bedrock probe)
    - Test API endpoints locally
    - _Requirements: 8.1, 8.5_

- [ ] 5. Local testing and validation
  - Test all Lambda functions with sample data locally
  - Validate categorization accuracy with diverse transaction types
  - Test fee detection with various subscription patterns
  - Verify recommendation generation produces actionable insights
  - _Requirements: 7.6, 8.1_

- [ ] 5.5 AgentCore learning and scripted registration (Day 7 afternoon - CRITICAL)
  - Review AWS Bedrock AgentCore documentation thoroughly
  - Study Action Groups examples in AWS samples repository
  - Test simple "hello world" agent with 1 tool before real implementation
  - Create scripts/register-agent.ts for reproducible AgentCore setup
  - Identify potential blockers and prepare backup plan
  - **Backup Plan**: If AgentCore fails, use direct Lambda invocation + Step Functions for tool coordination
  - _Requirements: 7.2, 7.3_

## Week 2: AWS Integration + Demo Prep

### Days 8-9: AgentCore Integration (CRITICAL PATH)

- [ ] 6. Deploy Lambda functions to AWS
  - Deploy all 3 Lambda functions with proper IAM roles
  - Configure API Gateway for REST endpoints
  - Test deployed functions with sample data
  - Verify CloudWatch logging and monitoring
  - _Requirements: 7.6, 8.1_

- [ ] 7. Configure Bedrock AgentCore (HIGH RISK - ALLOW EXTRA TIME)
  - [ ] 7.1 Set up Memory Management primitive
    - Configure AgentCore with session context persistence in DynamoDB
    - Set up memory management for user preferences and learning data
    - Test memory persistence across agent sessions
    - _Requirements: 7.2, 7.3, 8.6_

  - [ ] 7.2 Create Action Groups for Tool Orchestration with 5 specific tools
    - Define 5 agent tools: analyze_spending_patterns, categorize_transactions, detect_fees_and_subscriptions, generate_savings_recommendations, calculate_investment_readiness
    - Configure Action Groups in AgentCore console pointing to Lambda /tools/ endpoints
    - Commit OpenAPI/JSON schema used for registration under /infra/agent/
    - Test tool orchestration end-to-end (expect bugs, plan extra time)
    - Create tool call trace logging for demo documentation
    - _Requirements: 7.2, 7.3, 7.5, 8.6_

### Days 10-11: Autonomous Operation + Security

- [ ] 8. Implement autonomous operation with EventBridge Scheduler (timezone-aware)
  - Configure EventBridge Scheduler: cron(0 6 ? * SUN *) with timezone Europe/Sofia
  - Connect to weekly-insights-generator Lambda with proper IAM role
  - Add "Last autonomous run" tracking in DynamoDB for UI display
  - Set up CloudWatch Dashboard for Lambda duration/errors, API GW 4xx/5xx, DDB throttles
  - Enable X-Ray tracing on api-handler Lambda
  - _Requirements: 2.1, 7.5, 8.6_

- [ ] 8.5 Autonomous operation testing strategy (TIMING CRITICAL)
  - **If reached by Saturday**: Configure for Sunday 6 AM and verify Monday morning
  - **If behind schedule**: Manually trigger via AWS Console and show EventBridge config
  - **Backup**: Show CloudWatch Events logs from test invocation
  - Document EventBridge rule clearly for judges to verify autonomy capability
  - _Requirements: 7.5, 8.6_

- [ ] 9. Create Bedrock Guardrails for security and compliance
  - Set up Bedrock Guardrails for PII redaction and financial advice protection
  - Configure content filtering for sensitive information and prescriptive language
  - Test guardrails effectiveness with sample sensitive data
  - Include Guardrails policy JSON in repository for judges
  - _Requirements: 6.1, 6.2, 7.2, 4.1, 4.2_

### Day 12: External APIs (Minimal Implementation)

- [ ] 10. Add external API integrations with S3-cached responses
  - Set up Plaid sandbox with cached response in /cache/plaid/transactions.json
  - Integrate Alpha Vantage API with cached responses in /cache/alpha_vantage/AAPL_daily.json
  - Add feature flags: USE_CACHED_APIS=true, MODEL_TIER=haiku|sonnet, ENABLE_PLAID=false
  - Skip FRED API entirely if time-constrained
  - Create fallback to cached data for reliable demo presentation
  - _Requirements: 1.3, 7.4, 8.7_

### Day 13: UI + Optional Enhancements (Fast Build)

- [ ] 11. Build minimal Next.js App Router web application
  - Create Next.js App Router with /app/(routes)/upload for CSV, /app/insights for results
  - Build insights display with "Why this recommendation?" explanation cards
  - Implement "Last autonomous run" badge: "Last autonomous run: • 3 recs • 7.2s" (read from DDB)
  - Add basic progress tracking display (simple table, no fancy charts)
  - _Requirements: 2.4, 5.3, 8.4, 8.5_

- [ ] 12. Optional enhancements (only if ahead of schedule)
  - Consider adding simple financial education tooltips or help text
  - Add basic "Explain this term" functionality using static content
  - **Skip Amazon Q Business**: Requires AWS Organization + Identity Center setup ($1,500+/month)
  - Focus on core functionality - AgentCore integration is the priority
  - _Requirements: 4.3, 4.4_

### Day 14: Demo + Submission (Reserve Full Day)

- [ ] 13. Cost controls and deployment automation
  - Configure CloudWatch budget alarms at $50 and $75 thresholds
  - Create CDK deployment scripts with `make deploy` and `make destroy` commands
  - Test deployment process and verify teardown works
  - _Requirements: 8.1, 8.2_

- [ ] 13.5 Demo video pre-work (Day 13 evening - ESSENTIAL)
  - Write detailed demo script with exact timestamps (0:00-3:00)
  - Prepare all demo data and test scenarios
  - Record test run and identify potential issues
  - Pre-load all cached API responses for reliable demo
  - Test screen recording software and backup options
  - _Requirements: 8.4_

- [ ] 14. Demo preparation and submission materials
  - [ ] 14.1 Create architecture documentation
    - Generate architecture diagrams showing AWS services integration
    - Document AgentCore primitive usage with tool call traces
    - Capture screenshots of AgentCore console and CloudWatch logs
    - _Requirements: 8.2, 8.6_

  - [ ] 14.2 Record demo video and finalize submission (RESERVE 6-8 HOURS)
    - Block full day for recording, no other tasks scheduled
    - Record 3-minute demo video (expect multiple takes for bugs/clarity)
    - **Backup plan**: If technical issues, use slides + voiceover
    - Create submission text description highlighting key innovations
    - Final deployment test and submission
    - _Requirements: 8.3, 8.4, 8.5_

## Features to Cut If Time-Constrained (Priority Order)

**First to Cut:**
- Amazon Q Business integration (requires AWS Organization setup, $1,500+/month)
- FRED API (Alpha Vantage alone is sufficient)
- Advanced progress tracking UI (show data in simple table)
- Investment readiness assessment (focus on savings recommendations)

**Last to Keep (Core Requirements):**
- Bedrock AgentCore with 5 tools (REQUIRED)
- EventBridge autonomous trigger (REQUIRED for "autonomous" claim)
- Bedrock Guardrails policies (REQUIRED for safety)
- At least 1 external API (REQUIRED for integration)
- Basic CSV upload and insights display (REQUIRED for demo)
## Critical Path Analysis & Success Criteria

### Absolute Must-Complete Items for Viable Demo

**By Day 7 (Week 1 End):**
- ✅ CSV processing working locally
- ✅ DynamoDB storing data correctly  
- ✅ 3 Lambda functions working with sample data
- ⚠️ **BLOCKER**: Bedrock access approved (if not approved, project fails)

**By Day 11 (Tuesday Week 2):**
- ✅ AgentCore calling your Lambda functions (even if buggy)
- ✅ EventBridge configured for autonomous triggers
- ✅ Bedrock Guardrails policies created and tested
- ⚠️ **RISK**: If AgentCore fails, activate backup plan (direct Lambda + Step Functions)

**By Day 13 (Thursday Week 2):**
- ✅ Basic UI showing CSV upload and insights display
- ✅ Demo script written with exact timing
- ✅ Architecture diagrams completed
- ⚠️ **CUT**: Amazon Q if behind schedule

**Day 14 (Friday):**
- ✅ Demo video recorded (6-8 hours reserved)
- ✅ GitHub repository polished with README
- ✅ Final submission completed

### Realistic Success Probability Assessment

- **If everything goes well**: 85% chance of strong submission
- **If typical issues occur**: 65% chance of acceptable submission  
- **If major blocker hits**: 40% chance (Bedrock delay, AgentCore failure)

### Backup Plans for High-Risk Items

**If AgentCore Integration Fails (Days 8-9):**
- Use direct Lambda invocation via API Gateway
- Show tool coordination through Step Functions
- Demonstrate autonomous capability via EventBridge
- Explain: "Architecture supports AgentCore; demo shows core workflow"

**If Autonomous Testing Can't Complete (Day 10):**
- Manually trigger via AWS Console during demo
- Show EventBridge configuration and CloudWatch logs
- Document rule clearly for judges to verify capability

**If Demo Video Production Struggles (Day 14):**
- Use slides + voiceover as backup
- Focus on architecture screenshots and code walkthrough
- Emphasize working components over polished presentation

### Key Success Factors

1. **Bedrock Access**: Must be approved by Day 3 or project is at risk
2. **AgentCore Preparation**: Study examples on Day 7 before attempting integration
3. **Incremental Testing**: Test each component as built, don't wait until end
4. **Aggressive Feature Cutting**: Cut Amazon Q, FRED API, advanced UI if behind schedule
5. **Demo Preparation**: Start script writing Day 13 evening, reserve full Day 14 for recording
## Techn
ical Implementation Details

### Repository Structure
```
/app            # Next.js App Router
/infra          # CDK stacks (S3, DDB, Lambdas, API GW, EventBridge)
/infra/agent    # AgentCore action-group schema + scripts
/scripts        # seed.ts, register-agent.ts
/guardrails     # policy.json + tests
/docs           # diagrams, tool-trace.png, runbook.md
/cache          # S3-cached API responses for demo
```

### Makefile Commands
```makefile
.PHONY: deploy destroy seed
deploy: ; npm -w infra run cdk:deploy
seed: ; npx ts-node scripts/seed.ts
destroy: ; npm -w infra run cdk:destroy --all --force
```

### Guardrails Policy (guardrails/policy.json)
```json
{
  "policies": [
    { 
      "type": "pii_redaction", 
      "entities": ["CREDIT_CARD_NUMBER","IBAN","BANK_ACCOUNT_NUMBER"] 
    },
    { 
      "type": "deny", 
      "name": "NoPrescriptiveAdvice",
      "triggers": ["You should invest", "Buy [A-Z]{1,5}", "Allocate [0-9]+%"],
      "message": "I can provide educational information only, not financial advice." 
    }
  ]
}
```

### EventBridge Scheduler Configuration (UTC vs Europe/Sofia)
```typescript
import { Schedule, FlexibleTimeWindow } from 'aws-cdk-lib/aws-scheduler';

new Schedule(stack, 'WeeklyInsights', {
  scheduleExpression: 'cron(0 6 ? * SUN *)', // 06:00 Sofia time
  scheduleExpressionTimezone: 'Europe/Sofia',
  target: { arn: weeklyInsightsLambda.functionArn, roleArn: schedulerRole.roleArn },
  flexibleTimeWindow: { mode: FlexibleTimeWindowMode.OFF }
});
```

## Final Acceptance Checklist (Paste into README)

- [ ] AgentCore configured with Memory + Action Groups; screenshot + action-group JSON present
- [ ] EventBridge (or Scheduler) rule exists; UI shows last run; CloudWatch logs confirm invocation
- [ ] Guardrails JSON in repo; unit tests for redaction/advice blocking pass
- [ ] One external API integrated (cached for demo)
- [ ] `make deploy`, `make seed`, `make destroy` work; `/health` returns 200
- [ ] 3-min video follows: CSV → tool calls → insights → "Why this?" → autonomy badge
- [ ] Repository includes: architecture diagrams, tool call traces, deployment instructions
- [ ] CloudWatch Dashboard shows Lambda metrics, X-Ray tracing enabled
- [ ] Feature flags allow demo-safe operation with cached responses