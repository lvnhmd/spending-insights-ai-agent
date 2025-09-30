import { describe, it, expect } from '@jest/globals';

describe('Guardrails Policy', () => {
  const policy = require('./policy.json');

  it('should block credit card numbers', () => {
    const piiConfig = policy.sensitiveInformationPolicyConfig.piiEntitiesConfig;
    const creditCardRule = piiConfig.find((c: any) => 
      c.type === 'CREDIT_DEBIT_CARD_NUMBER'
    );
    expect(creditCardRule.action).toBe('BLOCK');
  });

  it('should deny prescriptive financial advice', () => {
    const topicConfig = policy.topicPolicyConfig.topicsConfig;
    const financialAdviceRule = topicConfig.find((t: any) => 
      t.name === 'FinancialAdvice'
    );
    expect(financialAdviceRule.type).toBe('DENY');
    expect(financialAdviceRule.examples.length).toBeGreaterThan(0);
  });
});
