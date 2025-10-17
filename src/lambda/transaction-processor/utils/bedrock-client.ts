/**
 * Bedrock Client with Guardrails Integration for Transaction Processor
 * 
 * Provides secure LLM interactions with PII protection and financial advice filtering
 * Requirements: 6.1, 6.2, 7.2, 4.1, 4.2
 */

import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelCommandInput } from '@aws-sdk/client-bedrock-runtime';

export interface BedrockConfig {
  region: string;
  guardrailId?: string;
  guardrailVersion?: string;
  modelId: string;
}

export interface BedrockRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface BedrockResponse {
  content: string;
  guardrailAction?: 'NONE' | 'BLOCKED' | 'ANONYMIZED';
  guardrailReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Bedrock client with integrated guardrails for secure financial AI interactions
 */
export class SecureBedrockClient {
  private client: BedrockRuntimeClient;
  private config: BedrockConfig;

  constructor(config: BedrockConfig) {
    this.config = config;
    this.client = new BedrockRuntimeClient({ 
      region: config.region,
      maxAttempts: 3,
    });
  }

  /**
   * Invoke a model with guardrails protection
   */
  async invokeModel(request: BedrockRequest): Promise<BedrockResponse> {
    const { prompt, maxTokens = 1000, temperature = 0.1, systemPrompt } = request;

    // Construct the message for Claude
    const messages = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Add system prompt if provided
    const body: any = {
      anthropic_version: 'bedrock-2023-05-31',
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    // Add guardrails if configured
    if (this.config.guardrailId && this.config.guardrailVersion) {
      body.guardrailIdentifier = this.config.guardrailId;
      body.guardrailVersion = this.config.guardrailVersion;
    }

    const input: InvokeModelCommandInput = {
      modelId: this.config.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    };

    try {
      const command = new InvokeModelCommand(input);
      const response = await this.client.send(command);

      if (!response.body) {
        throw new Error('No response body from Bedrock');
      }

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Handle guardrail actions
      let guardrailAction: 'NONE' | 'BLOCKED' | 'ANONYMIZED' = 'NONE';
      let guardrailReason: string | undefined;

      if (responseBody.guardrail) {
        const guardrail = responseBody.guardrail;
        if (guardrail.action === 'BLOCKED') {
          guardrailAction = 'BLOCKED';
          guardrailReason = 'Content blocked by guardrails due to policy violation';
          return {
            content: 'I cannot provide this response as it may contain sensitive information or inappropriate financial advice. Please rephrase your request.',
            guardrailAction,
            guardrailReason,
          };
        } else if (guardrail.action === 'ANONYMIZED') {
          guardrailAction = 'ANONYMIZED';
          guardrailReason = 'Content anonymized to protect sensitive information';
        }
      }

      // Extract content from Claude response
      let content = '';
      if (responseBody.content && responseBody.content.length > 0) {
        content = responseBody.content[0].text || '';
      }

      // Extract usage information
      const usage = responseBody.usage ? {
        inputTokens: responseBody.usage.input_tokens || 0,
        outputTokens: responseBody.usage.output_tokens || 0,
      } : undefined;

      return {
        content,
        guardrailAction,
        guardrailReason,
        usage,
      };

    } catch (error) {
      console.error('Bedrock invocation error:', error);
      
      // Check if it's a guardrail-related error
      if (error instanceof Error && error.message.includes('guardrail')) {
        return {
          content: 'I cannot process this request as it contains sensitive information or inappropriate content.',
          guardrailAction: 'BLOCKED',
          guardrailReason: 'Request blocked by guardrails',
        };
      }

      throw new Error(`Bedrock invocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Categorize transactions with guardrails protection
   */
  async categorizeTransaction(transaction: {
    description: string;
    amount: number;
    date: string;
  }): Promise<{
    category: string;
    subcategory: string;
    confidence: number;
    reasoning: string;
  }> {
    const systemPrompt = `You are a financial transaction categorization expert. Categorize transactions accurately and provide reasoning.

IMPORTANT: Never provide specific financial advice. Only categorize transactions and provide educational information.

Categories: Food & Dining, Shopping, Transportation, Bills & Utilities, Entertainment, Healthcare, Travel, Income, Transfers, Fees & Charges, Other

Respond in JSON format:
{
  "category": "category_name",
  "subcategory": "specific_subcategory",
  "confidence": 0.95,
  "reasoning": "Brief explanation of categorization"
}`;

    const prompt = `Categorize this transaction:
Description: ${transaction.description}
Amount: $${transaction.amount}
Date: ${transaction.date}

Provide categorization with reasoning.`;

    try {
      const response = await this.invokeModel({
        prompt,
        systemPrompt,
        maxTokens: 500,
        temperature: 0.1,
      });

      // Parse JSON response
      const result = JSON.parse(response.content);
      return {
        category: result.category || 'Other',
        subcategory: result.subcategory || 'Uncategorized',
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || 'Automated categorization',
      };

    } catch (error) {
      console.warn('Transaction categorization failed, using fallback:', error);
      
      // Fallback categorization
      return {
        category: 'Other',
        subcategory: 'Uncategorized',
        confidence: 0.1,
        reasoning: 'Fallback categorization due to processing error',
      };
    }
  }
}

/**
 * Create a configured Bedrock client instance
 */
export function createSecureBedrockClient(): SecureBedrockClient {
  const config: BedrockConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
    guardrailId: process.env.BEDROCK_GUARDRAIL_ID,
    guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION,
    modelId: process.env.MODEL_MODE === 'bedrock' 
      ? 'anthropic.claude-3-5-sonnet-20241022-v2:0'
      : 'anthropic.claude-3-haiku-20240307-v1:0',
  };

  return new SecureBedrockClient(config);
}