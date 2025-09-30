# CSV Processing and Data Models

This module provides TypeScript interfaces and utilities for processing transaction CSV data with built-in PII redaction and error handling.

## Features

- **TypeScript Interfaces**: Complete type definitions for Transaction, WeeklyInsight, and Recommendation data models
- **CSV Parser**: Robust CSV parsing with error handling for malformed data
- **PII Redaction**: Automatic detection and redaction of sensitive information (credit cards, SSNs, phone numbers, etc.)
- **Data Sanitization**: Transaction data cleaning and normalization
- **Comprehensive Testing**: Full unit and integration test coverage

## Requirements Addressed

- **1.1**: CSV file parsing and import functionality
- **1.2**: Automatic transaction categorization support
- **1.4**: Manual categorization learning capability
- **6.2**: PII redaction and data protection

## Usage

### Basic CSV Processing

```typescript
import { parseTransactionCSV } from './utils/csv-parser';

const csvContent = `date,description,amount,account
01/15/2024,Starbucks Coffee,4.95,Checking
01/16/2024,Amazon Purchase,-29.99,Credit Card`;

const result = parseTransactionCSV(csvContent, 'user-123');

console.log(`Processed ${result.successfulRows} transactions`);
console.log(`Found ${result.errors.length} errors`);
```

### PII Redaction

```typescript
import { sanitizeTransactionData } from './utils/pii-redaction';

const description = 'Payment to card 4532-1234-5678-9012';
const result = sanitizeTransactionData(description);

console.log(result.redactedText); // "Payment to card ****-****-****-9012"
console.log(result.redactedFields); // Array of redacted PII fields
```

### Data Models

```typescript
import { Transaction, WeeklyInsight, Recommendation } from './types';

// Use the TypeScript interfaces for type safety
const transaction: Transaction = {
  id: 'tx-123',
  userId: 'user-456',
  amount: 25.99,
  description: 'Coffee Shop',
  category: 'Food & Dining',
  date: new Date(),
  account: 'Checking',
  isRecurring: false,
  confidence: 0.95,
  transactionType: 'debit'
};
```

## Testing

Run the test suite:

```bash
npm test -- --testPathPatterns="src/utils/__tests__"
```

## Sample Data

The module includes sample CSV files for testing:

- `src/test-data/sample-transactions.csv` - Clean transaction data
- `src/test-data/sample-with-pii.csv` - Data with PII for redaction testing
- `src/test-data/malformed-data.csv` - Malformed data for error handling testing