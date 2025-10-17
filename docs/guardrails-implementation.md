# Bedrock Guardrails Implementation

## Overview

This document describes the comprehensive Bedrock Guardrails implementation for the Spending Insights AI Agent, providing security and compliance for financial data processing and AI interactions.

## Requirements Satisfied

- **Requirement 6.1**: Bank-level encryption and data protection
- **Requirement 6.2**: AWS Guardrails for PII redaction and data protection  
- **Requirement 7.2**: Bedrock AgentCore integration with security controls
- **Requirement 4.1**: Educational content labeling and advice disclaimers
- **Requirement 4.2**: Clear separation of educational vs. prescriptive content

## Implementation Components

### 1. Guardrails Policy Configuration

**File**: `guardrails/policy.json`

The policy includes comprehensive protection across multiple dimensions:

#### Content Policy
- **Prompt Attack Protection**: High-strength filtering for input and output
- **Jailbreak Protection**: Prevents attempts to bypass guardrails

#### Sensitive Information Policy
**Blocked (Complete Removal):**
- Credit/Debit Card Numbers
- Social Security Numbers  
- US Passport Numbers

**Anonymized (Replaced with Placeholders):**
- Bank Account Numbers → `[BANK_ACCOUNT]`
- Email Addresses → `[EMAIL]`
- Phone Numbers → `[PHONE]`
- Physical Addresses → `[ADDRESS]`
- Names → `[NAME]`
- IBAN Numbers → `[IBAN]`
- SWIFT/BIC Codes → `[SWIFT_CODE]`

#### Topic Policy
**Denied Topics:**
- **Prescriptive Financial Advice**: "You should buy X stock"
- **Specific Securities Recommendations**: "Invest in AAPL" or "Buy SPY ETF"
- **Definitive Financial Guidance**: "You must allocate 60% to stocks"

#### Word Policy
- Filters financial advice keywords
- Managed profanity filtering
- Custom financial terms blocking

#### Contextual Grounding
- **Grounding Threshold**: 75% - Ensures responses are factually grounded
- **Relevance Threshold**: 75% - Ensures responses are relevant to queries

### 2. Secure Bedrock Client

**Files**: 
- `src/utils/bedrock-client.ts` (main implementation)
- `src/lambda/transaction-processor/utils/bedrock-client.ts` (Lambda-specific)

#### Key Features:
- **Automatic Guardrails Integration**: All LLM calls include guardrail protection
- **Error Handling**: Graceful fallbacks when guardrails block content
- **PII Protection**: Automatic redaction of sensitive information
- **Financial Advice Filtering**: Prevents prescriptive investment recommendations
- **Usage Tracking**: Monitors token usage and guardrail actions

#### Example Usage:
```typescript
const client = createSecureBedrockClient();
const response = await client.invokeModel({
  prompt: "Help me categorize this transaction",
  systemPrompt: "You are a financial categorization expert...",
  maxTokens: 500
});

// Response includes guardrail information
console.log(response.guardrailAction); // 'NONE', 'BLOCKED', or 'ANONYMIZED'
console.log(response.guardrailReason); // Explanation if action taken
```

### 3. CDK Infrastructure Integration

**File**: `infra/lib/spending-insights-stack.ts`

The CDK stack includes:
- **Bedrock Guardrail Resource**: Automatically creates and versions the guardrail
- **IAM Permissions**: Lambda functions can invoke models with guardrails
- **Environment Variables**: Guardrail ID and version passed to Lambda functions

#### Key Configuration:
```typescript
// Bedrock Guardrail Creation
const bedrockGuardrail = new bedrock.CfnGuardrail(this, 'SpendingInsightsGuardrail', {
  name: 'SpendingInsightsGuardrails',
  contentPolicyConfig: { /* ... */ },
  sensitiveInformationPolicyConfig: { /* ... */ },
  topicPolicyConfig: { /* ... */ },
  // ... other configurations
});

// Environment Variables
const lambdaEnvironment = {
  BEDROCK_GUARDRAIL_ID: bedrockGuardrail.attrGuardrailId,
  BEDROCK_GUARDRAIL_VERSION: guardrailVersion.attrVersion,
  // ... other variables
};
```

### 4. Lambda Function Integration

**File**: `src/lambda/transaction-processor/index.ts`

Transaction processing includes guardrails protection:

```typescript
async function callBedrockForCategorization(transaction: Transaction) {
  if (process.env.MODEL_MODE !== 'bedrock') {
    return mockResponse; // Development fallback
  }

  const client = createSecureBedrockClient();
  const result = await client.categorizeTransaction({
    description: transaction.description,
    amount: transaction.amount,
    date: transaction.date.toISOString(),
  });

  // Result automatically includes PII protection and advice filtering
  return result;
}
```

### 5. Testing and Validation

#### Unit Tests
**File**: `guardrails/guardrails.test.ts`
- Validates policy configuration structure
- Ensures all required protection rules are present
- Tests rule logic and expected behaviors

#### Integration Tests  
**File**: `guardrails/test-sensitive-data.ts`
- Simulates real-world scenarios with sensitive data
- Tests edge cases and boundary conditions
- Provides visual feedback on guardrail effectiveness

#### Comprehensive Testing
**File**: `scripts/test-guardrails-integration.ts`
- Tests actual AWS Bedrock integration
- Validates PII protection, financial advice blocking, content filtering
- Tests transaction categorization with guardrails

### 6. Deployment Scripts

#### Guardrails Deployment
**File**: `scripts/deploy-guardrails.ts`
- Automated deployment of guardrails to AWS Bedrock
- Policy validation before deployment
- Version management and rollback support

#### Usage:
```bash
# Deploy guardrails to AWS
npx ts-node scripts/deploy-guardrails.ts

# Test guardrails effectiveness
npx ts-node scripts/test-guardrails-integration.ts

# Run local simulation tests
npx ts-node guardrails/test-sensitive-data.ts
```

## Security Features

### 1. Multi-Layer Protection
- **Input Filtering**: Blocks malicious prompts and PII before processing
- **Output Filtering**: Sanitizes responses to prevent data leakage
- **Content Analysis**: Contextual understanding prevents advice generation
- **Topic Blocking**: Specific financial advice topics are denied

### 2. PII Protection Levels
- **Complete Blocking**: Credit cards, SSN, passports (high-risk data)
- **Anonymization**: Bank accounts, emails, phones (medium-risk data)
- **Pattern Recognition**: IBAN, SWIFT codes via regex patterns

### 3. Financial Compliance
- **Investment Advice Prevention**: Blocks specific stock/fund recommendations
- **Disclaimer Enforcement**: Ensures educational content includes appropriate disclaimers
- **Regulatory Compliance**: Prevents unlicensed financial advice

### 4. Audit and Monitoring
- **Action Logging**: All guardrail actions are logged for compliance review
- **Usage Tracking**: Token usage and guardrail effectiveness metrics
- **Error Monitoring**: Failed requests and blocked content tracking

## Demo and Evaluation

### For Hackathon Judges

1. **Policy Visibility**: Complete `policy.json` included in repository
2. **Test Evidence**: Comprehensive test suite demonstrates effectiveness
3. **Real-world Scenarios**: Test cases cover actual sensitive data types
4. **Interactive Demo**: Run test scripts for live demonstration

### Demo Commands:
```bash
# Show guardrails policy
cat guardrails/policy.json

# Run effectiveness tests
npx ts-node guardrails/test-sensitive-data.ts

# Test AWS integration (requires deployment)
npx ts-node scripts/test-guardrails-integration.ts
```

### Expected Demo Results:
- ✅ Credit card numbers blocked completely
- ✅ Bank account numbers anonymized to `[BANK_ACCOUNT]`
- ✅ "Buy Tesla stock" blocked as financial advice
- ✅ Educational content about emergency funds allowed
- ✅ PII in transaction descriptions properly redacted

## Troubleshooting

### Common Issues

1. **Over-blocking**: If legitimate content is blocked
   - Review topic definitions and examples in `policy.json`
   - Adjust confidence thresholds in contextual grounding

2. **Under-blocking**: If inappropriate content passes through
   - Add more specific examples to topic configurations
   - Increase filter strength levels

3. **Performance Impact**: If response times are slow
   - Consider adjusting grounding/relevance thresholds
   - Monitor token usage and optimize prompts

### Debugging Steps

1. **Check Logs**: CloudWatch logs show guardrail actions
2. **Test Scripts**: Use provided test scripts to validate behavior
3. **Policy Validation**: Run deployment script with validation
4. **Environment Variables**: Ensure guardrail ID/version are set correctly

## Cost Considerations

### Guardrails Pricing
- **Per Request**: Small additional cost per Bedrock invocation
- **Development**: Use mock mode to avoid costs during development
- **Production**: Monitor usage through CloudWatch metrics

### Optimization Strategies
- **Caching**: Cache common categorization results
- **Batch Processing**: Group similar requests when possible
- **Model Selection**: Use Claude Haiku for simple tasks, Sonnet for complex analysis

## Future Enhancements

### Potential Improvements
1. **Custom PII Types**: Add industry-specific sensitive data patterns
2. **Dynamic Thresholds**: Adjust filtering based on user context
3. **Advanced Analytics**: Detailed reporting on guardrail effectiveness
4. **Multi-Language Support**: Extend protection to non-English content

### Monitoring and Alerting
1. **Guardrail Bypass Attempts**: Alert on repeated blocked requests
2. **PII Exposure**: Monitor for potential data leakage
3. **Performance Metrics**: Track response times and success rates
4. **Compliance Reporting**: Generate regular security compliance reports

## Conclusion

The Bedrock Guardrails implementation provides comprehensive security and compliance for the Spending Insights AI Agent, ensuring:

- **Data Protection**: Multi-level PII protection with blocking and anonymization
- **Financial Compliance**: Prevention of unlicensed financial advice
- **Content Security**: Protection against prompt attacks and inappropriate content
- **Transparency**: Clear explanations and audit trails for all actions
- **Scalability**: Efficient implementation suitable for production deployment

This implementation satisfies all security requirements while maintaining the educational and supportive nature of the AI agent, making it safe for users to interact with their sensitive financial data.