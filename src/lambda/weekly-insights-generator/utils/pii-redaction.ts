/**
 * PII Redaction utilities for transaction data sanitization
 * Requirements: 6.2 - Data protection and PII redaction
 */

import { PIIRedactionResult, PIIField } from '../types';

/**
 * Patterns for detecting PII in transaction descriptions
 */
const PII_PATTERNS = {
  // Credit card numbers (various formats) - check first as they're most specific
  card_number: [
    /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, // 16-digit cards
    /\b\d{4}[\s\-]?\d{6}[\s\-]?\d{5}\b/g, // 15-digit Amex
  ],
  
  // Social Security Numbers (specific format)
  ssn: [
    /\b\d{3}[\s\-]\d{2}[\s\-]\d{4}\b/g, // Require separators for SSN
  ],
  
  // Bank account numbers (8-17 digits without separators)
  account_number: [
    /\b\d{8,17}\b/g,
  ],
  
  // Phone numbers
  phone: [
    /\b\d{3}[\s\-\.]?\d{3}[\s\-\.]?\d{4}\b/g,
    /\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{4}/g,
  ],
  
  // Email addresses
  email: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ],
  
  // Street addresses (basic pattern)
  address: [
    /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct)\b/gi,
  ],
};

/**
 * Redaction replacements for different PII types
 */
const REDACTION_REPLACEMENTS = {
  card_number: '****-****-****-XXXX',
  account_number: '****XXXX',
  ssn: '***-**-XXXX',
  phone: '***-***-XXXX',
  email: '[EMAIL_REDACTED]',
  address: '[ADDRESS_REDACTED]',
};

/**
 * Sanitize transaction data by redacting PII
 */
export function sanitizeTransactionData(text: string): PIIRedactionResult {
  if (!text || typeof text !== 'string') {
    return {
      originalText: text || '',
      redactedText: text || '',
      redactedFields: [],
    };
  }

  const result: PIIRedactionResult = {
    originalText: text,
    redactedText: text,
    redactedFields: [],
  };

  // Process each PII type
  for (const [piiType, patterns] of Object.entries(PII_PATTERNS)) {
    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(result.redactedText)) !== null) {
        const originalValue = match[0];
        const redactedValue = generateRedactedValue(piiType as keyof typeof REDACTION_REPLACEMENTS, originalValue);
        
        // Store redaction info
        result.redactedFields.push({
          type: piiType as PIIField['type'],
          originalValue,
          redactedValue,
          startIndex: match.index,
          endIndex: match.index + originalValue.length,
        });

        // Replace in text
        result.redactedText = result.redactedText.replace(originalValue, redactedValue);
        
        // Reset regex to avoid infinite loops
        regex.lastIndex = 0;
      }
    }
  }

  return result;
}

/**
 * Generate appropriate redacted value for PII type
 */
function generateRedactedValue(piiType: keyof typeof REDACTION_REPLACEMENTS, originalValue: string): string {
  const baseReplacement = REDACTION_REPLACEMENTS[piiType];
  
  switch (piiType) {
    case 'card_number':
      // Keep last 4 digits for card numbers
      if (originalValue.length >= 4) {
        const lastFour = originalValue.slice(-4);
        return `****-****-****-${lastFour}`;
      }
      return baseReplacement;
      
    case 'account_number':
      // Keep last 4 digits for account numbers if long enough
      if (originalValue.length >= 8) {
        const lastFour = originalValue.slice(-4);
        return `****${lastFour}`;
      }
      return baseReplacement;
      
    case 'ssn':
      // Always use standard SSN redaction format
      return baseReplacement;
      
    case 'phone':
      // Keep area code for phone numbers
      const phoneDigits = originalValue.replace(/\D/g, '');
      if (phoneDigits.length === 10) {
        return `${phoneDigits.slice(0, 3)}-***-****`;
      }
      return baseReplacement;
      
    default:
      return baseReplacement;
  }
}

/**
 * Check if text contains potential PII
 */
export function containsPII(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  for (const patterns of Object.values(PII_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get PII risk score for text (0-1, higher means more PII detected)
 */
export function getPIIRiskScore(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  let piiCount = 0;
  let totalMatches = 0;

  for (const patterns of Object.values(PII_PATTERNS)) {
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        piiCount++;
        totalMatches += matches.length;
      }
    }
  }

  // Normalize score based on text length and PII density
  const textLength = text.length;
  const density = totalMatches / Math.max(textLength / 100, 1); // Per 100 characters
  
  return Math.min(density * 0.5 + (piiCount > 0 ? 0.3 : 0), 1);
}

/**
 * Validate that PII redaction was successful
 */
export function validateRedaction(original: string, redacted: string): boolean {
  // Check that no obvious PII patterns remain in redacted text
  for (const patterns of Object.values(PII_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(redacted)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Batch sanitize multiple transaction descriptions
 */
export function batchSanitizeTransactions(descriptions: string[]): PIIRedactionResult[] {
  return descriptions.map(description => sanitizeTransactionData(description));
}