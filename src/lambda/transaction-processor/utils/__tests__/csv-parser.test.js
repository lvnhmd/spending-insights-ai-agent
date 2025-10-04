"use strict";
/**
 * Unit tests for CSV parser functionality
 * Requirements: 1.1, 1.2, 1.4, 6.2
 */
Object.defineProperty(exports, "__esModule", { value: true });
const csv_parser_1 = require("../csv-parser");
describe('CSVParser', () => {
    const userId = 'test-user-123';
    let parser;
    beforeEach(() => {
        parser = new csv_parser_1.CSVParser(userId);
    });
    describe('parseCSV', () => {
        it('should parse valid CSV with all required fields', () => {
            const csvContent = `date,description,amount,account,category
01/15/2024,Starbucks Coffee,4.95,Checking,Food
01/16/2024,Amazon Purchase,-29.99,Credit Card,Shopping
01/17/2024,Salary Deposit,2500.00,Checking,Income`;
            const result = parser.parseCSV(csvContent);
            expect(result.totalRows).toBe(3);
            expect(result.successfulRows).toBe(3);
            expect(result.errors).toHaveLength(0);
            expect(result.transactions).toHaveLength(3);
            const firstTransaction = result.transactions[0];
            expect(firstTransaction.userId).toBe(userId);
            expect(firstTransaction.description).toBe('Starbucks Coffee');
            expect(firstTransaction.amount).toBe(4.95);
            expect(firstTransaction.category).toBe('Food');
            expect(firstTransaction.account).toBe('Checking');
            expect(firstTransaction.transactionType).toBe('credit');
        });
        it('should handle CSV with quoted fields containing commas', () => {
            const csvContent = `date,description,amount
01/15/2024,"Restaurant, Downtown Location",25.50
01/16/2024,"Amazon Purchase, Electronics",199.99`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(2);
            expect(result.transactions[0].description).toBe('Restaurant, Downtown Location');
            expect(result.transactions[1].description).toBe('Amazon Purchase, Electronics');
        });
        it('should handle different date formats', () => {
            const csvContent = `date,description,amount
01/15/2024,Purchase 1,10.00
2024-01-16,Purchase 2,20.00
1/17/2024,Purchase 3,30.00`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(3);
            expect(result.transactions[0].date).toEqual(new Date(2024, 0, 15));
            expect(result.transactions[1].date).toEqual(new Date(2024, 0, 16));
            expect(result.transactions[2].date).toEqual(new Date(2024, 0, 17));
        });
        it('should handle negative amounts correctly', () => {
            const csvContent = `date,description,amount
01/15/2024,Expense,-50.00
01/16/2024,Income,100.00`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(2);
            expect(result.transactions[0].amount).toBe(50.00);
            expect(result.transactions[0].transactionType).toBe('debit');
            expect(result.transactions[1].amount).toBe(100.00);
            expect(result.transactions[1].transactionType).toBe('credit');
        });
        it('should handle currency symbols in amounts', () => {
            const csvContent = `date,description,amount
01/15/2024,Purchase,$25.99
01/16/2024,Refund,-$10.50`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(2);
            expect(result.transactions[0].amount).toBe(25.99);
            expect(result.transactions[1].amount).toBe(10.50);
        });
        it('should extract merchant names from descriptions', () => {
            const csvContent = `date,description,amount
01/15/2024,POS STARBUCKS STORE #1234,4.95
01/16/2024,ACH AMAZON.COM AMZN.COM/BILL,29.99
01/17/2024,CHECK DEPOSIT,100.00`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(3);
            expect(result.transactions[0].merchantName).toBe('STARBUCKS STORE #1234');
            expect(result.transactions[1].merchantName).toBe('AMAZON.COM AMZN.COM/BILL');
            expect(result.transactions[2].merchantName).toBe('DEPOSIT');
        });
    });
    describe('error handling', () => {
        it('should return error for empty CSV', () => {
            const result = parser.parseCSV('');
            expect(result.totalRows).toBe(0);
            expect(result.successfulRows).toBe(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toBe('CSV file is empty');
        });
        it('should return error for missing required headers', () => {
            const csvContent = `name,value
John,100`;
            const result = parser.parseCSV(csvContent);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toContain('Missing required headers');
        });
        it('should handle rows with missing required fields', () => {
            const csvContent = `date,description,amount
01/15/2024,Valid Transaction,10.00
,Missing Date,20.00
01/17/2024,,30.00
01/18/2024,Missing Amount,`;
            const result = parser.parseCSV(csvContent);
            expect(result.totalRows).toBe(4);
            expect(result.successfulRows).toBe(1);
            expect(result.errors).toHaveLength(3);
            const errorMessages = result.errors.map(e => e.error);
            expect(errorMessages).toContain('Date is required');
            expect(errorMessages).toContain('Description is required');
            expect(errorMessages).toContain('Amount is required');
        });
        it('should handle invalid date formats', () => {
            const csvContent = `date,description,amount
invalid-date,Transaction,10.00
13/45/2024,Another Transaction,20.00`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(0);
            expect(result.errors).toHaveLength(2);
            expect(result.errors[0].error).toContain('Invalid date format');
            expect(result.errors[1].error).toContain('Invalid date format');
        });
        it('should handle invalid amount formats', () => {
            const csvContent = `date,description,amount
01/15/2024,Transaction,not-a-number
01/16/2024,Another Transaction,10.99.99`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(0);
            expect(result.errors).toHaveLength(2);
            expect(result.errors[0].error).toContain('Invalid amount format');
            expect(result.errors[1].error).toContain('Invalid amount format');
        });
        it('should handle malformed CSV rows gracefully', () => {
            const csvContent = `date,description,amount
01/15/2024,Valid Transaction,10.00
This is not a valid CSV row
01/17/2024,Another Valid Transaction,20.00`;
            const result = parser.parseCSV(csvContent);
            expect(result.totalRows).toBe(3);
            expect(result.successfulRows).toBe(2);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.row === 3)).toBe(true);
        });
    });
    describe('header mapping', () => {
        it('should map common header variations', () => {
            const csvContent = `Date,Memo,Debit Amount,Account Name
01/15/2024,Coffee Shop,4.95,My Checking`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(1);
            expect(result.transactions[0].description).toBe('Coffee Shop');
            expect(result.transactions[0].amount).toBe(4.95);
            expect(result.transactions[0].account).toBe('My Checking');
        });
        it('should handle case-insensitive headers', () => {
            const csvContent = `DATE,DESCRIPTION,AMOUNT
01/15/2024,TRANSACTION,10.00`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(1);
            expect(result.transactions[0].description).toBe('TRANSACTION');
        });
    });
    describe('transaction type detection', () => {
        it('should detect transaction types from type column', () => {
            const csvContent = `date,description,amount,type
01/15/2024,Purchase,10.00,debit
01/16/2024,Deposit,100.00,credit`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(2);
            expect(result.transactions[0].transactionType).toBe('debit');
            expect(result.transactions[1].transactionType).toBe('credit');
        });
        it('should infer transaction type from amount sign when no type column', () => {
            const csvContent = `date,description,amount
01/15/2024,Expense,-50.00
01/16/2024,Income,100.00`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(2);
            expect(result.transactions[0].transactionType).toBe('debit');
            expect(result.transactions[1].transactionType).toBe('credit');
        });
    });
    describe('parseTransactionCSV utility function', () => {
        it('should work as a standalone function', () => {
            const csvContent = `date,description,amount
01/15/2024,Test Transaction,25.00`;
            const result = (0, csv_parser_1.parseTransactionCSV)(csvContent, userId);
            expect(result.successfulRows).toBe(1);
            expect(result.transactions[0].userId).toBe(userId);
            expect(result.transactions[0].description).toBe('Test Transaction');
        });
    });
    describe('data sanitization integration', () => {
        it('should sanitize PII in transaction descriptions', () => {
            const csvContent = `date,description,amount
01/15/2024,Payment to 4532-1234-5678-9012,100.00
01/16/2024,Transfer from account 123456789,50.00`;
            const result = parser.parseCSV(csvContent);
            expect(result.successfulRows).toBe(2);
            // Check that PII was redacted
            expect(result.transactions[0].description).not.toContain('4532-1234-5678-9012');
            expect(result.transactions[0].description).toContain('****-****-****-9012');
            expect(result.transactions[1].description).not.toContain('123456789');
            expect(result.transactions[1].description).toContain('****6789');
            // Original descriptions should be preserved
            expect(result.transactions[0].originalDescription).toContain('4532-1234-5678-9012');
            expect(result.transactions[1].originalDescription).toContain('123456789');
        });
    });
});
