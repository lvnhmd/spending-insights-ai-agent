import { describe, it, expect } from '@jest/globals';

describe('Guardrails Policy', () => {
  const policy = require('./policy.json');

  describe('PII Protection', () => {
    it('should block credit card numbers', () => {
      const piiConfig = policy.sensitiveInformationPolicyConfig.piiEntitiesConfig;
      const creditCardRule = piiConfig.find((c: any) => 
        c.type === 'CREDIT_DEBIT_CARD_NUMBER'
      );
      expect(creditCardRule.action).toBe('BLOCK');
    });

    it('should block social security numbers', () => {
      const piiConfig = policy.sensitiveInformationPolicyConfig.piiEntitiesConfig;
      const ssnRule = piiConfig.find((c: any) => 
        c.type === 'US_SOCIAL_SECURITY_NUMBER'
      );
      expect(ssnRule.action).toBe('BLOCK');
    });

    it('should anonymize bank account numbers', () => {
      const piiConfig = policy.sensitiveInformationPolicyConfig.piiEntitiesConfig;
      const bankRule = piiConfig.find((c: any) => 
        c.type === 'US_BANK_ACCOUNT_NUMBER'
      );
      expect(bankRule.action).toBe('ANONYMIZE');
    });

    it('should anonymize email addresses', () => {
      const piiConfig = policy.sensitiveInformationPolicyConfig.piiEntitiesConfig;
      const emailRule = piiConfig.find((c: any) => 
        c.type === 'EMAIL'
      );
      expect(emailRule.action).toBe('ANONYMIZE');
    });

    it('should have regex patterns for international banking', () => {
      const regexConfig = policy.sensitiveInformationPolicyConfig.regexesConfig;
      const ibanRule = regexConfig.find((r: any) => r.name === 'IBAN');
      const swiftRule = regexConfig.find((r: any) => r.name === 'SWIFT_CODE');
      
      expect(ibanRule).toBeDefined();
      expect(ibanRule.action).toBe('ANONYMIZE');
      expect(swiftRule).toBeDefined();
      expect(swiftRule.action).toBe('ANONYMIZE');
    });
  });

  describe('Financial Advice Protection', () => {
    it('should deny prescriptive financial advice', () => {
      const topicConfig = policy.topicPolicyConfig.topicsConfig;
      const financialAdviceRule = topicConfig.find((t: any) => 
        t.name === 'PrescriptiveFinancialAdvice'
      );
      expect(financialAdviceRule.type).toBe('DENY');
      expect(financialAdviceRule.examples.length).toBeGreaterThan(0);
    });

    it('should deny specific securities recommendations', () => {
      const topicConfig = policy.topicPolicyConfig.topicsConfig;
      const securitiesRule = topicConfig.find((t: any) => 
        t.name === 'SpecificSecuritiesRecommendations'
      );
      expect(securitiesRule.type).toBe('DENY');
      expect(securitiesRule.examples).toContain('Buy AAPL stock');
    });

    it('should deny definitive financial guidance', () => {
      const topicConfig = policy.topicPolicyConfig.topicsConfig;
      const guidanceRule = topicConfig.find((t: any) => 
        t.name === 'DefinitiveFinancialGuidance'
      );
      expect(guidanceRule.type).toBe('DENY');
      expect(guidanceRule.examples.length).toBeGreaterThan(0);
    });
  });

  describe('Content Filtering', () => {
    it('should have prompt attack protection', () => {
      const contentFilters = policy.contentPolicyConfig.filtersConfig;
      const promptAttackFilter = contentFilters.find((f: any) => 
        f.type === 'PROMPT_ATTACK'
      );
      expect(promptAttackFilter.inputStrength).toBe('HIGH');
      expect(promptAttackFilter.outputStrength).toBe('HIGH');
    });

    it('should have jailbreak protection', () => {
      const contentFilters = policy.contentPolicyConfig.filtersConfig;
      const jailbreakFilter = contentFilters.find((f: any) => 
        f.type === 'JAILBREAK'
      );
      expect(jailbreakFilter.inputStrength).toBe('HIGH');
      expect(jailbreakFilter.outputStrength).toBe('HIGH');
    });

    it('should filter financial advice related words', () => {
      const wordConfig = policy.wordPolicyConfig.wordsConfig;
      const financialAdviceWord = wordConfig.find((w: any) => 
        w.text === 'financial advice'
      );
      expect(financialAdviceWord).toBeDefined();
    });

    it('should have profanity filtering', () => {
      const managedLists = policy.wordPolicyConfig.managedWordListsConfig;
      const profanityFilter = managedLists.find((l: any) => 
        l.type === 'PROFANITY'
      );
      expect(profanityFilter).toBeDefined();
    });
  });

  describe('Contextual Grounding', () => {
    it('should have grounding and relevance filters', () => {
      const groundingFilters = policy.contextualGroundingPolicyConfig.filtersConfig;
      const groundingFilter = groundingFilters.find((f: any) => 
        f.type === 'GROUNDING'
      );
      const relevanceFilter = groundingFilters.find((f: any) => 
        f.type === 'RELEVANCE'
      );
      
      expect(groundingFilter.threshold).toBe(0.75);
      expect(relevanceFilter.threshold).toBe(0.75);
    });
  });

  describe('Policy Structure', () => {
    it('should have required metadata', () => {
      expect(policy.name).toBe('SpendingInsightsGuardrails');
      expect(policy.description).toContain('PII redaction');
      expect(policy.description).toContain('financial advice protection');
      expect(policy.version).toBe('1.0');
    });

    it('should have all required configuration sections', () => {
      expect(policy.contentPolicyConfig).toBeDefined();
      expect(policy.sensitiveInformationPolicyConfig).toBeDefined();
      expect(policy.topicPolicyConfig).toBeDefined();
      expect(policy.wordPolicyConfig).toBeDefined();
      expect(policy.contextualGroundingPolicyConfig).toBeDefined();
    });
  });
});
