/**
 * Main exports for the Spending Insights CSV processing and data models
 * Requirements: 1.1, 1.2, 1.4, 6.2, 7.6, 8.1, 1.5
 */

// Type definitions
export * from './types';

// CSV processing utilities
export { CSVParser, parseTransactionCSV } from './utils/csv-parser';

// PII redaction utilities
export {
  sanitizeTransactionData,
  containsPII,
  getPIIRiskScore,
  validateRedaction,
  batchSanitizeTransactions
} from './utils/pii-redaction';

// Database operations
export * from './database';