/**
 * CSV Parser for transaction data with error handling and PII redaction
 * Requirements: 1.1, 1.2, 1.4, 6.2
 */

import { 
  Transaction, 
  RawTransactionRow, 
  CSVParseResult, 
  CSVParseError,
  PIIRedactionResult 
} from '../types';
import { sanitizeTransactionData } from './pii-redaction';
import { randomUUID } from 'crypto';

export class CSVParser {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Parse CSV content into transactions with error handling
   */
  public parseCSV(csvContent: string): CSVParseResult {
    const result: CSVParseResult = {
      transactions: [],
      errors: [],
      totalRows: 0,
      successfulRows: 0
    };

    try {
      const lines = csvContent.trim().split('\n');
      
      if (lines.length === 0 || csvContent.trim().length === 0) {
        result.errors.push({
          row: 0,
          error: 'CSV file is empty',
          severity: 'error'
        });
        return result;
      }

      // Parse header row
      const headers = this.parseCSVRow(lines[0]);
      const headerMap = this.mapHeaders(headers);
      
      if (!this.validateHeaders(headerMap)) {
        result.errors.push({
          row: 1,
          error: 'Missing required headers. Expected: date, description, amount',
          severity: 'error'
        });
        return result;
      }

      result.totalRows = lines.length - 1; // Exclude header

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const rowNumber = i + 1;
        
        try {
          const row = this.parseCSVRow(lines[i]);
          const rawTransaction = this.mapRowToTransaction(row, headerMap);
          
          // Validate row data
          const validationErrors = this.validateTransactionRow(rawTransaction, rowNumber);
          if (validationErrors.length > 0) {
            result.errors.push(...validationErrors);
            continue;
          }

          // Convert to Transaction object with PII redaction
          const transaction = this.convertToTransaction(rawTransaction, rowNumber);
          result.transactions.push(transaction);
          result.successfulRows++;

        } catch (error) {
          result.errors.push({
            row: rowNumber,
            error: `Failed to parse row: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          });
        }
      }

    } catch (error) {
      result.errors.push({
        row: 0,
        error: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }

    return result;
  }

  /**
   * Parse a single CSV row, handling quoted fields and commas
   */
  private parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    
    return result;
  }

  /**
   * Map CSV headers to expected field names
   */
  private mapHeaders(headers: string[]): Record<string, number> {
    const headerMap: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      
      // Map common header variations
      if (normalizedHeader.includes('date')) {
        headerMap.date = index;
      } else if (normalizedHeader.includes('description') || normalizedHeader.includes('memo')) {
        headerMap.description = index;
      } else if (normalizedHeader.includes('amount') || normalizedHeader.includes('debit') || normalizedHeader.includes('credit')) {
        headerMap.amount = index;
      } else if (normalizedHeader.includes('account')) {
        headerMap.account = index;
      } else if (normalizedHeader.includes('category')) {
        headerMap.category = index;
      } else if (normalizedHeader.includes('type')) {
        headerMap.type = index;
      }
    });

    return headerMap;
  }

  /**
   * Validate that required headers are present
   */
  private validateHeaders(headerMap: Record<string, number>): boolean {
    return headerMap.date !== undefined && 
           headerMap.description !== undefined && 
           headerMap.amount !== undefined;
  }

  /**
   * Map CSV row to raw transaction object
   */
  private mapRowToTransaction(row: string[], headerMap: Record<string, number>): RawTransactionRow {
    return {
      date: row[headerMap.date] || '',
      description: row[headerMap.description] || '',
      amount: row[headerMap.amount] || '',
      account: headerMap.account !== undefined ? row[headerMap.account] : 'Unknown',
      category: headerMap.category !== undefined ? row[headerMap.category] : undefined,
      type: headerMap.type !== undefined ? row[headerMap.type] : undefined
    };
  }

  /**
   * Validate transaction row data
   */
  private validateTransactionRow(transaction: RawTransactionRow, rowNumber: number): CSVParseError[] {
    const errors: CSVParseError[] = [];

    // Validate date
    if (!transaction.date) {
      errors.push({
        row: rowNumber,
        field: 'date',
        value: transaction.date,
        error: 'Date is required',
        severity: 'error'
      });
    } else if (!this.isValidDate(transaction.date)) {
      errors.push({
        row: rowNumber,
        field: 'date',
        value: transaction.date,
        error: 'Invalid date format. Expected MM/DD/YYYY or YYYY-MM-DD',
        severity: 'error'
      });
    }

    // Validate description
    if (!transaction.description || transaction.description.trim().length === 0) {
      errors.push({
        row: rowNumber,
        field: 'description',
        value: transaction.description,
        error: 'Description is required',
        severity: 'error'
      });
    }

    // Validate amount
    if (!transaction.amount) {
      errors.push({
        row: rowNumber,
        field: 'amount',
        value: transaction.amount,
        error: 'Amount is required',
        severity: 'error'
      });
    } else if (!this.isValidAmount(transaction.amount)) {
      errors.push({
        row: rowNumber,
        field: 'amount',
        value: transaction.amount,
        error: 'Invalid amount format. Expected numeric value',
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Convert raw transaction to Transaction object with PII redaction
   */
  private convertToTransaction(raw: RawTransactionRow, rowNumber: number): Transaction {
    // Parse and sanitize data
    const sanitizedDescription = sanitizeTransactionData(raw.description);
    const amount = this.parseAmount(raw.amount);
    const date = this.parseDate(raw.date);

    // Determine transaction type
    const transactionType = this.determineTransactionType(amount, raw.type);
    
    return {
      id: randomUUID(),
      userId: this.userId,
      amount: Math.abs(amount), // Store as positive number
      description: sanitizedDescription.redactedText,
      originalDescription: sanitizedDescription.originalText,
      category: raw.category || 'Uncategorized',
      date: date,
      account: raw.account || 'Unknown',
      isRecurring: false, // Will be determined by pattern analysis
      confidence: 0, // Will be set by AI categorization
      transactionType: transactionType,
      merchantName: this.extractMerchantName(sanitizedDescription.redactedText)
    };
  }

  /**
   * Validate date string
   */
  private isValidDate(dateStr: string): boolean {
    // Support common date formats: MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY
    const dateRegex = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})$/;
    if (!dateRegex.test(dateStr)) {
      return false;
    }

    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  /**
   * Validate amount string
   */
  private isValidAmount(amountStr: string): boolean {
    // Remove common currency symbols and whitespace
    const cleanAmount = amountStr.replace(/[$,\s]/g, '');
    
    // Check if it's a valid number (including negative)
    const numberRegex = /^-?\d+(\.\d{1,2})?$/;
    return numberRegex.test(cleanAmount);
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date {
    // Handle different date formats
    let date: Date;
    
    if (dateStr.includes('/')) {
      // MM/DD/YYYY or DD/MM/YYYY format
      const parts = dateStr.split('/');
      if (parts[2].length === 4) {
        // Assume MM/DD/YYYY
        date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      } else {
        date = new Date(dateStr);
      }
    } else {
      // YYYY-MM-DD or other formats
      date = new Date(dateStr);
    }

    return date;
  }

  /**
   * Parse amount string to number
   */
  private parseAmount(amountStr: string): number {
    // Remove currency symbols and whitespace
    const cleanAmount = amountStr.replace(/[$,\s]/g, '');
    return parseFloat(cleanAmount);
  }

  /**
   * Determine transaction type (debit/credit)
   */
  private determineTransactionType(amount: number, typeHint?: string): 'debit' | 'credit' {
    if (typeHint) {
      const normalizedType = typeHint.toLowerCase();
      if (normalizedType.includes('credit') || normalizedType.includes('deposit')) {
        return 'credit';
      }
      if (normalizedType.includes('debit') || normalizedType.includes('withdrawal')) {
        return 'debit';
      }
    }

    // Default: negative amounts are debits (expenses), positive are credits (income)
    return amount < 0 ? 'debit' : 'credit';
  }

  /**
   * Extract merchant name from description
   */
  private extractMerchantName(description: string): string {
    // Simple merchant name extraction - remove common prefixes/suffixes
    let merchantName = description
      .replace(/^(DEBIT|CREDIT|ACH|CHECK|ATM|POS)\s+/i, '')
      .replace(/\s+\d{2}\/\d{2}$/, '') // Remove date suffixes
      .trim();

    // Take first part before location or other details
    const parts = merchantName.split(/\s+(?:IN|AT|ON)\s+/i);
    return parts[0].trim();
  }
}

/**
 * Utility function to parse CSV file content
 */
export function parseTransactionCSV(csvContent: string, userId: string): CSVParseResult {
  const parser = new CSVParser(userId);
  return parser.parseCSV(csvContent);
}