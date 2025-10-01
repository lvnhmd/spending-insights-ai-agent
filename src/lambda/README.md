# Lambda Functions

This directory contains the core Lambda functions for the Spending Insights AI Agent.

## Functions Implemented

### 1. Transaction Processor (`transaction-processor/`)
**Requirements: 1.2, 1.4, 3.1, 3.2, 7.3**

- **Purpose**: Processes and categorizes financial transactions
- **Features**:
  - CSV parsing and transaction import
  - AI-powered transaction categorization using Claude 3 Haiku
  - Fee and subscription detection algorithms
  - Pattern recognition for recurring charges
  - Mock mode for testing without AWS calls

- **Key Operations**:
  - `process_csv`: Parse CSV and categorize all transactions
  - `categorize`: Categorize a batch of transactions
  - `detect_fees`: Detect fees and subscriptions in transactions

- **Mock Mode**: Set `MODEL_MODE=mock` to use rule-based categorization instead of Bedrock calls

### 2. Weekly Insights Generator (`weekly-insights-generator/`)
**Requirements: 2.1, 2.2, 2.3, 2.4, 7.3, 8.6**

- **Purpose**: Generates weekly spending insights and recommendations
- **Features**:
  - Spending pattern analysis and trend detection
  - Recommendation generation with impact vs effort prioritization
  - Post-hoc explanation generation for transparency
  - Savings calculations and actionable step guidance

- **Key Capabilities**:
  - Analyzes transactions by category and identifies patterns
  - Detects savings opportunities (subscriptions, fees, overspending)
  - Generates prioritized recommendations with action steps
  - Calculates potential savings and implementation difficulty

### 3. API Handler (`api-handler/`)
**Requirements: 8.1, 8.5**

- **Purpose**: REST API endpoints for the web application
- **Features**:
  - CSV upload and processing endpoints
  - User management (create, get user profiles)
  - Transaction retrieval with date filtering
  - Insights retrieval and generation triggers
  - Health and readiness check endpoints
  - Proper CORS handling and error responses

- **Key Endpoints**:
  - `GET /health` - Static health check
  - `GET /readiness` - DynamoDB and Bedrock connectivity check
  - `POST /users` - Create user profile
  - `POST /transactions/upload` - Upload and process CSV
  - `GET /users/{userId}/transactions` - Get user transactions
  - `GET /users/{userId}/insights` - Get user insights
  - `POST /users/{userId}/insights/generate` - Trigger insights generation

## Testing

### Local Testing
```bash
cd src/lambda
npm install
npm run test:local
```

This runs all functions in mock mode without making AWS calls.

### Test Results
The local test successfully:
- Processed 4 sample transactions from CSV
- Categorized transactions (Groceries, Transportation, Entertainment, Fees)
- Detected 2 potential savings opportunities (Netflix subscription, bank fee)
- Generated 2 recommendations with $251.88 total potential savings
- Responded to health check with proper CORS headers

## Configuration

### Runtime
- **Node.js 20.x** - Updated from Node.js 18 to comply with AWS Lambda runtime support policy
- Node.js 18 reaches end-of-life on September 1, 2025

### Environment Variables
- `MODEL_MODE=mock` - Use mock responses instead of Bedrock calls
- Standard AWS Lambda environment variables for DynamoDB and Bedrock access

### Dependencies
- `@aws-sdk/client-bedrock-runtime` - For AI model calls
- `@aws-sdk/lib-dynamodb` - For database operations
- `@aws-sdk/client-lambda` - For Lambda invocations

## Architecture Integration

These Lambda functions integrate with:
- **DynamoDB**: For storing transactions, insights, and user profiles
- **Bedrock**: For AI-powered categorization and analysis (when not in mock mode)
- **API Gateway**: For REST API exposure
- **EventBridge**: For autonomous weekly insights generation

## Next Steps

1. **Deploy to AWS**: Update CDK stack to deploy actual function code
2. **Enable Bedrock**: Implement real Bedrock API calls for production
3. **Add EventBridge Integration**: Connect weekly insights generator to scheduler
4. **Implement AgentCore**: Add Bedrock AgentCore integration for tool orchestration
5. **Add External APIs**: Integrate Plaid and financial data services

## Mock vs Production Behavior

### Mock Mode (Current)
- Rule-based transaction categorization
- Simulated fee detection patterns
- No external API calls
- Immediate responses for testing

### Production Mode (Future)
- Claude 3 Haiku for transaction categorization
- Claude 3.5 Sonnet for insights generation
- Real-time fee detection with historical analysis
- External API integration for enhanced data