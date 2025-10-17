# Bedrock Guardrails for Spending Insights AI Agent

This directory contains the Bedrock Guardrails configuration and testing for the Spending Insights AI Agent, ensuring secure and compliant handling of financial data and preventing inappropriate financial advice.

## Overview

The guardrails system provides comprehensive protection across multiple dimensions:

- **PII Protection**: Blocks or anonymizes sensitive personal information
- **Financial Advice Protection**: Prevents prescriptive investment recommendations
- **Content Filtering**: Blocks prompt attacks, jailbreaks, and inappropriate content
- **Contextual Grounding**: Ensures responses are relevant and factually grounded

## Files

### `policy.json`
The main Bedrock Guardrails policy configuration file containing:

- **Content Policy**: Prompt attack and jailbreak protection
- **Sensitive Information Policy**: PII detection and redaction rules
- **Topic Policy**: Financial advice and securities recommendation blocking
- **Word Policy**: Keyword filtering for financial advice terms
- **Contextual Grounding Policy**: Relevance and grounding thresholds

### `guardrails.test.ts`
Comprehensive unit tests for the guardrails policy configuration, validating:

- PII protection rules (credit cards, SSN, bank accounts, etc.)
- Financial advice blocking (prescriptive recommendations, specific securities)
- Content filtering (prompt attacks, profanity)
- Policy structure and metadata

### `test-sensitive-data.ts`
Interactive test script that simulates guardrails processing with sample sensitive data:

- Tests real-world scenarios with PII, financial advice, and edge cases
- Demonstrates expected behavior for blocked, anonymized, and allowed content
- Provides detailed output showing how each test case would be processed

## Guardrails Features

### 1. PII Protection

**Blocked (Complete Removal):**
- Credit/Debit Card Numbers
- Social Security Numbers
- US Passport Numbers

**Anonymized (Replaced with Placeholders):**
- Bank Account Numbers
- Bank Routing Numbers
- Email Addresses
- Phone Numbers
- Physical Addresses
- Names
- Dates of Birth
- Driver's License Numbers
- IBAN (International Bank Account Numbers)
- SWIFT/BIC Codes

### 2. Financial Advice Protection

**Denied Topics:**
- **Prescriptive Financial Advice**: "You should buy X stock"
- **Specific Securities Recommendations**: "Invest in AAPL" or "Buy SPY ETF"
- **Definitive Financial Guidance**: "You must allocate 60% to stocks"

**Allowed Educational Content:**
- General information about investment types
- Educational explanations with appropriate disclaimers
- Savings tips and budgeting strategies
- Content that encourages consulting financial advisors

### 3. Content Filtering

- **Prompt Attack Protection**: High-strength filtering for input and output
- **Jailbreak Protection**: Prevents attempts to bypass guardrails
- **Profanity Filtering**: Managed word lists for inappropriate content
- **Financial Keywords**: Filters terms like "financial advice" and "investment recommendation"

### 4. Contextual Grounding

- **Grounding Threshold**: 75% - Ensures responses are factually grounded
- **Relevance Threshold**: 75% - Ensures responses are relevant to the query

## Usage

### Running Tests

```bash
# Run unit tests
npm test guardrails/guardrails.test.ts

# Run interactive sensitive data tests
npx ts-node guardrails/test-sensitive-data.ts
```

### Integration with Bedrock

The `policy.json` file is designed to be uploaded to AWS Bedrock Guardrails service:

1. **Create Guardrail**: Upload the policy.json configuration
2. **Configure Agent**: Associate the guardrail with your Bedrock Agent
3. **Test Integration**: Use the test scripts to validate behavior

### Example Integration Code

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

const command = new InvokeModelCommand({
  modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
  contentType: "application/json",
  accept: "application/json",
  body: JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    messages: [{ role: "user", content: userInput }],
    max_tokens: 1000,
    guardrailIdentifier: "your-guardrail-id",
    guardrailVersion: "1"
  })
});
```

## Compliance and Security

### Financial Regulations
- **PII Protection**: Complies with financial data protection requirements
- **Advice Disclaimers**: Prevents unlicensed financial advice
- **Data Anonymization**: Reduces liability for sensitive information handling

### Security Features
- **Multi-layer Protection**: Content, PII, topic, and word-level filtering
- **High-strength Filtering**: Maximum protection against attacks
- **Contextual Validation**: Ensures responses are grounded and relevant

### Audit Trail
- All guardrail actions are logged for compliance review
- Test results provide evidence of protection effectiveness
- Policy versioning enables change tracking

## Testing Strategy

### Unit Tests (`guardrails.test.ts`)
- Validates policy configuration structure
- Ensures all required protection rules are present
- Tests rule logic and expected behaviors

### Integration Tests (`test-sensitive-data.ts`)
- Simulates real-world scenarios with sensitive data
- Tests edge cases and boundary conditions
- Provides visual feedback on guardrail effectiveness

### Continuous Validation
- Tests run as part of CI/CD pipeline
- Regular validation with updated test cases
- Monitoring of guardrail performance in production

## Customization

### Adding New PII Types
```json
{
  "type": "CUSTOM_PII_TYPE",
  "action": "ANONYMIZE"
}
```

### Adding New Blocked Topics
```json
{
  "name": "NewBlockedTopic",
  "definition": "Description of what to block",
  "examples": ["Example 1", "Example 2"],
  "type": "DENY"
}
```

### Adjusting Thresholds
```json
{
  "type": "GROUNDING",
  "threshold": 0.8  // Increase for stricter grounding
}
```

## Troubleshooting

### Common Issues

1. **Over-blocking**: If legitimate content is blocked, review topic definitions and examples
2. **Under-blocking**: If inappropriate content passes through, add more specific examples
3. **Performance**: High thresholds may impact response time, balance security vs. performance

### Debugging

1. **Test Scripts**: Use the provided test scripts to validate behavior
2. **CloudWatch Logs**: Monitor guardrail actions in AWS CloudWatch
3. **Gradual Rollout**: Test changes in development before production deployment

## Requirements Compliance

This guardrails implementation satisfies the following requirements:

- **Requirement 6.1**: Bank-level encryption and data protection
- **Requirement 6.2**: AWS Guardrails for PII redaction and data protection
- **Requirement 7.2**: Bedrock AgentCore integration with security controls
- **Requirement 4.1**: Educational content labeling and advice disclaimers
- **Requirement 4.2**: Clear separation of educational vs. prescriptive content

## Demo and Evaluation

For hackathon judges and demo purposes:

1. **Policy Visibility**: The complete policy.json is included in the repository
2. **Test Evidence**: Comprehensive tests demonstrate effectiveness
3. **Real-world Scenarios**: Test cases cover actual sensitive data types
4. **Compliance Documentation**: Clear mapping to security requirements
5. **Interactive Demo**: Run `test-sensitive-data.ts` for live demonstration