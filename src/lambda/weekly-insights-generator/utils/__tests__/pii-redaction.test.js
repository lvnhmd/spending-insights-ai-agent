"use strict";
/**
 * Unit tests for PII redaction functionality
 * Requirements: 6.2 - Data protection and PII redaction
 */
Object.defineProperty(exports, "__esModule", { value: true });
const pii_redaction_1 = require("../pii-redaction");
describe('PII Redaction', () => {
    describe('sanitizeTransactionData', () => {
        it('should redact credit card numbers', () => {
            const testCases = [
                {
                    input: 'Payment to 4532-1234-5678-9012',
                    expected: 'Payment to ****-****-****-9012'
                },
                {
                    input: 'Card ending 4532 1234 5678 9012',
                    expected: 'Card ending ****-****-****-9012'
                },
                {
                    input: 'Amex 3782 822463 10005',
                    expected: 'Amex ****-****-****-0005'
                }
            ];
            testCases.forEach(({ input, expected }) => {
                const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
                expect(result.redactedText).toBe(expected);
                expect(result.originalText).toBe(input);
                expect(result.redactedFields).toHaveLength(1);
                expect(result.redactedFields[0].type).toBe('card_number');
            });
        });
        it('should redact bank account numbers', () => {
            const testCases = [
                {
                    input: 'Transfer from account 123456789',
                    expected: 'Transfer from account ****6789'
                },
                {
                    input: 'Account 12345678901234567',
                    expected: 'Account ****4567'
                }
            ];
            testCases.forEach(({ input, expected }) => {
                const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
                expect(result.redactedText).toBe(expected);
                expect(result.redactedFields[0].type).toBe('account_number');
            });
        });
        it('should redact Social Security Numbers', () => {
            const testCases = [
                {
                    input: 'SSN: 123-45-6789',
                    expected: 'SSN: ***-**-XXXX'
                },
                {
                    input: 'Social Security 123-45-6789',
                    expected: 'Social Security ***-**-XXXX'
                },
                {
                    input: 'ID 123-45-6789',
                    expected: 'ID ***-**-XXXX'
                }
            ];
            testCases.forEach(({ input, expected }) => {
                const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
                expect(result.redactedText).toBe(expected);
                expect(result.redactedFields[0].type).toBe('ssn');
            });
        });
        it('should redact phone numbers', () => {
            const testCases = [
                {
                    input: 'Call 555-123-4567',
                    expected: 'Call 555-***-****'
                },
                {
                    input: 'Phone (555) 123-4567',
                    expected: 'Phone 555-***-****'
                },
                {
                    input: 'Contact 555.123.4567',
                    expected: 'Contact 555-***-****'
                }
            ];
            testCases.forEach(({ input, expected }) => {
                const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
                expect(result.redactedText).toBe(expected);
                expect(result.redactedFields[0].type).toBe('phone');
            });
        });
        it('should redact email addresses', () => {
            const input = 'Send receipt to john.doe@example.com';
            const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
            expect(result.redactedText).toBe('Send receipt to [EMAIL_REDACTED]');
            expect(result.redactedFields[0].type).toBe('email');
            expect(result.redactedFields[0].originalValue).toBe('john.doe@example.com');
        });
        it('should redact street addresses', () => {
            const testCases = [
                {
                    input: 'Delivery to 123 Main Street',
                    expected: 'Delivery to [ADDRESS_REDACTED]'
                },
                {
                    input: 'Address: 456 Oak Avenue',
                    expected: 'Address: [ADDRESS_REDACTED]'
                },
                {
                    input: 'Located at 789 Pine Road',
                    expected: 'Located at [ADDRESS_REDACTED]'
                }
            ];
            testCases.forEach(({ input, expected }) => {
                const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
                expect(result.redactedText).toBe(expected);
                expect(result.redactedFields[0].type).toBe('address');
            });
        });
        it('should handle multiple PII types in one string', () => {
            const input = 'Payment from 4532-1234-5678-9012 to account 987654321 for john@example.com';
            const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
            expect(result.redactedText).toBe('Payment from ****-****-****-9012 to account ****4321 for [EMAIL_REDACTED]');
            expect(result.redactedFields).toHaveLength(3);
            const types = result.redactedFields.map(field => field.type);
            expect(types).toContain('card_number');
            expect(types).toContain('account_number');
            expect(types).toContain('email');
        });
        it('should handle empty or null input', () => {
            const testCases = ['', null, undefined];
            testCases.forEach(input => {
                const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
                expect(result.redactedText).toBe(input || '');
                expect(result.originalText).toBe(input || '');
                expect(result.redactedFields).toHaveLength(0);
            });
        });
        it('should handle text with no PII', () => {
            const input = 'Regular coffee purchase at Starbucks';
            const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
            expect(result.redactedText).toBe(input);
            expect(result.originalText).toBe(input);
            expect(result.redactedFields).toHaveLength(0);
        });
        it('should preserve redaction field positions', () => {
            const input = 'Card 4532-1234-5678-9012 used';
            const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
            expect(result.redactedFields[0].startIndex).toBe(5);
            expect(result.redactedFields[0].endIndex).toBe(24);
            expect(result.redactedFields[0].originalValue).toBe('4532-1234-5678-9012');
        });
    });
    describe('containsPII', () => {
        it('should detect presence of PII', () => {
            const testCases = [
                { input: 'Card 4532-1234-5678-9012', expected: true },
                { input: 'Account 123456789', expected: true },
                { input: 'SSN 123-45-6789', expected: true },
                { input: 'Phone 555-123-4567', expected: true },
                { input: 'Email john@example.com', expected: true },
                { input: '123 Main Street', expected: true },
                { input: 'Regular transaction', expected: false },
                { input: '', expected: false },
                { input: null, expected: false }
            ];
            testCases.forEach(({ input, expected }) => {
                expect((0, pii_redaction_1.containsPII)(input)).toBe(expected);
            });
        });
    });
    describe('getPIIRiskScore', () => {
        it('should return 0 for text with no PII', () => {
            expect((0, pii_redaction_1.getPIIRiskScore)('Regular coffee purchase')).toBe(0);
            expect((0, pii_redaction_1.getPIIRiskScore)('')).toBe(0);
            expect((0, pii_redaction_1.getPIIRiskScore)(null)).toBe(0);
        });
        it('should return higher scores for text with more PII', () => {
            const lowRisk = (0, pii_redaction_1.getPIIRiskScore)('Card ending in 1234');
            const mediumRisk = (0, pii_redaction_1.getPIIRiskScore)('Card 4532-1234-5678-9012');
            const highRisk = (0, pii_redaction_1.getPIIRiskScore)('Card 4532-1234-5678-9012 account 987654321 john@example.com');
            expect(lowRisk).toBe(0);
            expect(mediumRisk).toBeGreaterThan(0);
            expect(highRisk).toBeGreaterThan(mediumRisk);
            expect(highRisk).toBeLessThanOrEqual(1);
        });
        it('should normalize scores based on text length', () => {
            const shortText = 'Card 4532-1234-5678-9012';
            const longText = 'This is a very long transaction description with lots of additional text and details about the purchase including the card 4532-1234-5678-9012 that was used for payment';
            const shortScore = (0, pii_redaction_1.getPIIRiskScore)(shortText);
            const longScore = (0, pii_redaction_1.getPIIRiskScore)(longText);
            expect(shortScore).toBeGreaterThan(longScore);
        });
    });
    describe('validateRedaction', () => {
        it('should return true for successful redaction', () => {
            const original = 'Payment with card 4532-1234-5678-9012';
            const redacted = 'Payment with card ****-****-****-9012';
            expect((0, pii_redaction_1.validateRedaction)(original, redacted)).toBe(true);
        });
        it('should return false if PII remains in redacted text', () => {
            const original = 'Payment with card 4532-1234-5678-9012';
            const redacted = 'Payment with card 4532-1234-5678-9012'; // Not redacted
            expect((0, pii_redaction_1.validateRedaction)(original, redacted)).toBe(false);
        });
        it('should return true for text with no PII', () => {
            const text = 'Regular coffee purchase';
            expect((0, pii_redaction_1.validateRedaction)(text, text)).toBe(true);
        });
    });
    describe('batchSanitizeTransactions', () => {
        it('should sanitize multiple descriptions', () => {
            const descriptions = [
                'Payment with card 4532-1234-5678-9012',
                'Transfer to account 987654321',
                'Regular coffee purchase'
            ];
            const results = (0, pii_redaction_1.batchSanitizeTransactions)(descriptions);
            expect(results).toHaveLength(3);
            expect(results[0].redactedText).toBe('Payment with card ****-****-****-9012');
            expect(results[1].redactedText).toBe('Transfer to account ****4321');
            expect(results[2].redactedText).toBe('Regular coffee purchase');
        });
        it('should handle empty array', () => {
            const results = (0, pii_redaction_1.batchSanitizeTransactions)([]);
            expect(results).toHaveLength(0);
        });
    });
    describe('edge cases', () => {
        it('should handle escaped quotes in PII patterns', () => {
            const input = 'Card "4532-1234-5678-9012" was used';
            const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
            expect(result.redactedText).toBe('Card "****-****-****-9012" was used');
        });
        it('should handle PII at string boundaries', () => {
            const input = '4532-1234-5678-9012';
            const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
            expect(result.redactedText).toBe('****-****-****-9012');
        });
        it('should handle overlapping PII patterns', () => {
            // This tests a case where multiple patterns might match the same text
            const input = 'Account 1234567890123456'; // Could match both account and card patterns
            const result = (0, pii_redaction_1.sanitizeTransactionData)(input);
            // Should be redacted by one of the patterns
            expect(result.redactedText).not.toBe(input);
            expect(result.redactedFields.length).toBeGreaterThan(0);
        });
        it('should handle very long strings with PII', () => {
            const longDescription = 'A'.repeat(1000) + ' card 4532-1234-5678-9012 ' + 'B'.repeat(1000);
            const result = (0, pii_redaction_1.sanitizeTransactionData)(longDescription);
            expect(result.redactedText).toContain('****-****-****-9012');
            expect(result.redactedFields).toHaveLength(1);
        });
    });
});
