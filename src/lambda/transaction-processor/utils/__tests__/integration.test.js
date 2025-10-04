"use strict";
/**
 * Integration tests for CSV processing with sample data
 * Requirements: 1.1, 1.2, 1.4, 6.2
 */
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const csv_parser_1 = require("../csv-parser");
describe('CSV Processing Integration Tests', () => {
    const userId = 'integration-test-user';
    it('should process sample transactions CSV successfully', () => {
        const csvPath = (0, path_1.join)(__dirname, '../../test-data/sample-transactions.csv');
        const csvContent = (0, fs_1.readFileSync)(csvPath, 'utf-8');
        const result = (0, csv_parser_1.parseTransactionCSV)(csvContent, userId);
        expect(result.totalRows).toBe(15);
        expect(result.successfulRows).toBe(15);
        expect(result.errors).toHaveLength(0);
        expect(result.transactions).toHaveLength(15);
        // Verify first transaction
        const firstTransaction = result.transactions[0];
        expect(firstTransaction.description).toBe('Starbucks Coffee #1234');
        expect(firstTransaction.amount).toBe(4.95);
        expect(firstTransaction.category).toBe('Food & Dining');
        expect(firstTransaction.transactionType).toBe('debit');
        // Verify income transaction
        const salaryTransaction = result.transactions.find(t => t.description === 'Salary Deposit');
        expect(salaryTransaction).toBeDefined();
        expect(salaryTransaction.amount).toBe(2500.00);
        expect(salaryTransaction.transactionType).toBe('credit');
        // Verify all transactions have required fields
        result.transactions.forEach(transaction => {
            expect(transaction.id).toBeDefined();
            expect(transaction.userId).toBe(userId);
            expect(transaction.date).toBeInstanceOf(Date);
            expect(transaction.amount).toBeGreaterThan(0);
            expect(transaction.description).toBeTruthy();
            expect(transaction.account).toBeTruthy();
            expect(transaction.transactionType).toMatch(/^(debit|credit)$/);
        });
    });
    it('should handle CSV with PII and redact sensitive information', () => {
        const csvPath = (0, path_1.join)(__dirname, '../../test-data/sample-with-pii.csv');
        const csvContent = (0, fs_1.readFileSync)(csvPath, 'utf-8');
        const result = (0, csv_parser_1.parseTransactionCSV)(csvContent, userId);
        expect(result.totalRows).toBe(6);
        expect(result.successfulRows).toBe(6);
        expect(result.errors).toHaveLength(0);
        // Check that PII was redacted
        const cardPayment = result.transactions[0];
        expect(cardPayment.description).toContain('****-****-****-9012');
        expect(cardPayment.description).not.toContain('4532-1234-5678-9012');
        expect(cardPayment.originalDescription).toContain('4532-1234-5678-9012');
        const accountTransfer = result.transactions[1];
        expect(accountTransfer.description).toContain('****4321');
        expect(accountTransfer.description).not.toContain('987654321');
        const emailPayment = result.transactions[2];
        expect(emailPayment.description).toContain('[EMAIL_REDACTED]');
        expect(emailPayment.description).not.toContain('john.doe@example.com');
        const phoneCall = result.transactions[3];
        expect(phoneCall.description).toContain('555-***-****');
        expect(phoneCall.description).not.toContain('555-123-4567');
        const delivery = result.transactions[4];
        expect(delivery.description).toContain('[ADDRESS_REDACTED]');
        expect(delivery.description).not.toContain('123 Main Street');
        const ssnVerification = result.transactions[5];
        expect(ssnVerification.description).toContain('***-**-XXXX');
        expect(ssnVerification.description).not.toContain('123-45-6789');
    });
    it('should handle malformed CSV data gracefully', () => {
        const csvPath = (0, path_1.join)(__dirname, '../../test-data/malformed-data.csv');
        const csvContent = (0, fs_1.readFileSync)(csvPath, 'utf-8');
        const result = (0, csv_parser_1.parseTransactionCSV)(csvContent, userId);
        expect(result.totalRows).toBe(8);
        expect(result.successfulRows).toBe(2); // Only first and last rows are valid
        expect(result.errors.length).toBeGreaterThan(0);
        // Check that valid transactions were processed
        expect(result.transactions).toHaveLength(2);
        expect(result.transactions[0].description).toBe('Valid Transaction');
        expect(result.transactions[1].description).toBe('Final Valid Transaction');
        // Check error types
        const errorMessages = result.errors.map(e => e.error);
        expect(errorMessages.some(msg => msg.includes('Date is required'))).toBe(true);
        expect(errorMessages.some(msg => msg.includes('Description is required'))).toBe(true);
        expect(errorMessages.some(msg => msg.includes('Amount is required'))).toBe(true);
        expect(errorMessages.some(msg => msg.includes('Invalid date format'))).toBe(true);
        expect(errorMessages.some(msg => msg.includes('Invalid amount format'))).toBe(true);
    });
    it('should maintain data consistency across processing', () => {
        const csvPath = (0, path_1.join)(__dirname, '../../test-data/sample-transactions.csv');
        const csvContent = (0, fs_1.readFileSync)(csvPath, 'utf-8');
        const result = (0, csv_parser_1.parseTransactionCSV)(csvContent, userId);
        // Calculate total amounts by type
        const totalDebits = result.transactions
            .filter(t => t.transactionType === 'debit')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalCredits = result.transactions
            .filter(t => t.transactionType === 'credit')
            .reduce((sum, t) => sum + t.amount, 0);
        // Verify amounts are reasonable
        expect(totalDebits).toBeGreaterThan(0);
        expect(totalCredits).toBeGreaterThan(0);
        // Verify date consistency
        result.transactions.forEach(transaction => {
            expect(transaction.date.getFullYear()).toBe(2024);
            expect(transaction.date.getMonth()).toBe(0); // January (0-indexed)
        });
        // Verify no duplicate IDs
        const ids = result.transactions.map(t => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });
    it('should handle different CSV formats and encodings', () => {
        // Test with different separators and quote styles
        const csvContent = `"Date","Description","Amount","Account"
"01/15/2024","Coffee, Downtown","$4.95","Checking"
"01/16/2024","Amazon Purchase, Books & Electronics","$29.99","Credit Card"`;
        const result = (0, csv_parser_1.parseTransactionCSV)(csvContent, userId);
        expect(result.successfulRows).toBe(2);
        expect(result.transactions[0].description).toBe('Coffee, Downtown');
        expect(result.transactions[1].description).toBe('Amazon Purchase, Books & Electronics');
    });
    it('should preserve merchant information for analysis', () => {
        const csvPath = (0, path_1.join)(__dirname, '../../test-data/sample-transactions.csv');
        const csvContent = (0, fs_1.readFileSync)(csvPath, 'utf-8');
        const result = (0, csv_parser_1.parseTransactionCSV)(csvContent, userId);
        // Check merchant name extraction
        const starbucksTransaction = result.transactions.find(t => t.description.includes('Starbucks'));
        expect(starbucksTransaction?.merchantName).toBe('Starbucks Coffee #1234');
        const amazonTransaction = result.transactions.find(t => t.description.includes('Amazon'));
        expect(amazonTransaction?.merchantName).toBe('Amazon Prime Subscription');
        // Verify all transactions have merchant names
        result.transactions.forEach(transaction => {
            expect(transaction.merchantName).toBeTruthy();
            expect(transaction.merchantName.length).toBeGreaterThan(0);
        });
    });
});
