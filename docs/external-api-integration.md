# External API Integration

This document describes the external API integrations implemented for the Spending Insights AI Agent, including caching strategies and feature flags for reliable demo presentation.

## Overview

The system integrates with external financial APIs to provide comprehensive spending analysis and investment education context. All integrations include robust caching and fallback mechanisms to ensure reliable operation during demos and hackathon presentations.

## Integrated APIs

### 1. Plaid API (Sandbox)
- **Purpose**: Bank account and transaction data integration
- **Status**: Demo mode with cached responses
- **Cache Location**: `cache/plaid/transactions.json`
- **Features**:
  - Account balance information
  - Transaction categorization
  - Merchant identification
  - Recurring payment detection

### 2. Alpha Vantage API
- **Purpose**: Stock market data for investment education
- **Status**: Active with cached fallbacks
- **Cache Location**: `cache/alpha_vantage/AAPL_daily.json`
- **Features**:
  - Daily stock prices
  - Market overview data
  - Educational investment context

### 3. FRED API (Federal Reserve Economic Data)
- **Status**: Skipped for time constraints (as per requirements)
- **Alternative**: Static economic context data

## Feature Flags Configuration

The system uses feature flags to control API behavior and ensure reliable demo operation:

```json
{
  "USE_CACHED_APIS": true,
  "MODEL_TIER": "haiku",
  "ENABLE_PLAID": false,
  "ENABLE_ALPHA_VANTAGE": true,
  "ENABLE_FRED": false,
  "DEMO_MODE": true
}
```

### Feature Flag Descriptions

- **USE_CACHED_APIS**: Forces use of cached responses instead of live API calls
- **MODEL_TIER**: Controls which Bedrock model to use (haiku/sonnet)
- **ENABLE_PLAID**: Enables/disables Plaid API integration
- **ENABLE_ALPHA_VANTAGE**: Enables/disables Alpha Vantage API integration
- **ENABLE_FRED**: Enables/disables FRED API integration
- **DEMO_MODE**: Optimizes for demo presentation reliability

## API Endpoints

### External API Status
```
GET /external-apis/status
```
Returns the current status of all external API integrations and feature flags.

### Plaid Data
```
GET /users/{userId}/external-data/plaid
```
Retrieves cached or live Plaid transaction data for the specified user.

### Market Data
```
GET /users/{userId}/external-data/market
```
Retrieves market data for investment education context.

## Caching Strategy

### Local Development
- Cached responses stored in `cache/` directory
- File-based caching for development and testing
- Automatic fallback to cached data on API failures

### Lambda Environment
- Cached data embedded in Lambda code for reliability
- No external dependencies during demo
- Consistent response times

### Cache Structure

#### Plaid Cache (`cache/plaid/transactions.json`)
```json
{
  "accounts": [...],
  "transactions": [...],
  "total_transactions": 5,
  "request_id": "demo_request_001"
}
```

#### Alpha Vantage Cache (`cache/alpha_vantage/AAPL_daily.json`)
```json
{
  "Meta Data": {...},
  "Time Series (Daily)": {...}
}
```

## Implementation Details

### API Client Classes

#### PlaidClient
- Handles sandbox API integration
- Automatic fallback to cached data
- Transaction categorization support
- Account balance retrieval

#### AlphaVantageClient
- Stock price data retrieval
- Market overview information
- Educational content support
- Rate limiting protection

### Error Handling

1. **API Unavailable**: Automatic fallback to cached data
2. **Rate Limiting**: Exponential backoff with cached fallback
3. **Authentication Errors**: Clear error messages with fallback
4. **Network Issues**: Immediate cached response

### Security Considerations

- API keys stored in environment variables
- No sensitive data in cached responses
- PII redaction through Bedrock Guardrails
- Sandbox-only environments for financial data

## Demo Preparation

### Pre-Demo Checklist
- [ ] Verify cached data is current and realistic
- [ ] Test all API endpoints return expected responses
- [ ] Confirm feature flags are set for demo mode
- [ ] Validate fallback mechanisms work correctly

### Demo Script Integration

1. **Show API Status** (0:30-0:45)
   - Display `/external-apis/status` endpoint
   - Highlight cached vs live data usage
   - Demonstrate feature flag configuration

2. **External Data Integration** (1:30-1:45)
   - Show Plaid transaction import
   - Display Alpha Vantage market context
   - Explain educational vs advisory content

3. **Reliability Features** (2:15-2:30)
   - Demonstrate cached fallback
   - Show consistent response times
   - Highlight demo-safe operation

## Cost Controls

### Development Phase
- Maximum 5 Alpha Vantage API calls
- Plaid sandbox only (free tier)
- No FRED API calls (skipped)

### Demo Phase
- 100% cached responses
- Zero external API costs
- Predictable performance

### Budget Monitoring
- CloudWatch cost alarms
- API call counting
- Usage tracking per service

## Testing

### Unit Tests
```bash
npm run test:external-apis
```

### Integration Tests
```bash
npx ts-node scripts/test-external-apis.ts
```

### Performance Tests
- API response time validation
- Cached data retrieval speed
- Concurrent request handling

## Troubleshooting

### Common Issues

1. **Cached Data Not Loading**
   - Check file permissions in `cache/` directory
   - Verify JSON structure is valid
   - Ensure Lambda has embedded data

2. **API Calls Failing**
   - Verify feature flags configuration
   - Check environment variables
   - Confirm network connectivity

3. **Demo Inconsistencies**
   - Enable `DEMO_MODE` flag
   - Use `USE_CACHED_APIS: true`
   - Pre-load all cached responses

### Debug Commands

```bash
# Test API integration
npx ts-node scripts/test-external-apis.ts

# Check feature flags
curl https://api.example.com/external-apis/status

# Validate cached data
cat cache/plaid/transactions.json | jq .
cat cache/alpha_vantage/AAPL_daily.json | jq .
```

## Future Enhancements

### Post-Hackathon
- Real-time Plaid integration
- Multiple stock symbols support
- FRED economic data integration
- Advanced caching strategies

### Production Considerations
- Redis caching layer
- API rate limit management
- Real-time data synchronization
- Enhanced error recovery

## Compliance and Disclaimers

### Financial Data
- All investment information is educational only
- Clear disclaimers on all market data
- No prescriptive financial advice
- Sandbox data only for demos

### Privacy
- No real financial data in demos
- PII redaction enabled
- Secure API key management
- Audit trail for all API calls