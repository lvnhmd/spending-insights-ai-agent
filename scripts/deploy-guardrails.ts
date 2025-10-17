#!/usr/bin/env ts-node

/**
 * Deploy Bedrock Guardrails Script
 * 
 * This script deploys the guardrails policy to AWS Bedrock
 * Requirements: 6.1, 6.2, 7.2, 4.1, 4.2
 */

import { BedrockClient, CreateGuardrailCommand, CreateGuardrailVersionCommand, GetGuardrailCommand } from '@aws-sdk/client-bedrock';
import * as fs from 'fs';
import * as path from 'path';

interface GuardrailPolicy {
  name: string;
  description: string;
  version: string;
  contentPolicyConfig: any;
  sensitiveInformationPolicyConfig: any;
  topicPolicyConfig: any;
  wordPolicyConfig: any;
  contextualGroundingPolicyConfig: any;
}

/**
 * Deploy guardrails to AWS Bedrock
 */
async function deployGuardrails(): Promise<void> {
  console.log('🛡️  Deploying Bedrock Guardrails\n');

  // Load the guardrails policy
  const policyPath = path.join(__dirname, '../guardrails/policy.json');
  
  if (!fs.existsSync(policyPath)) {
    throw new Error(`Guardrails policy file not found: ${policyPath}`);
  }

  const policy: GuardrailPolicy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  console.log(`📋 Loaded policy: ${policy.name} v${policy.version}`);

  // Initialize Bedrock client
  const client = new BedrockClient({ 
    region: process.env.AWS_REGION || 'us-east-1',
    maxAttempts: 3,
  });

  try {
    // Check if guardrail already exists
    let guardrailId: string | undefined;
    
    try {
      // Try to get existing guardrail (this will fail if it doesn't exist)
      const existingGuardrails = await client.send(new GetGuardrailCommand({
        guardrailIdentifier: policy.name,
      }));
      
      if (existingGuardrails.guardrailId) {
        guardrailId = existingGuardrails.guardrailId;
        console.log(`✅ Found existing guardrail: ${guardrailId}`);
      }
    } catch (error) {
      // Guardrail doesn't exist, we'll create it
      console.log('📝 Guardrail does not exist, creating new one...');
    }

    if (!guardrailId) {
      // Create new guardrail
      console.log('🚀 Creating new guardrail...');
      
      const createCommand = new CreateGuardrailCommand({
        name: policy.name,
        description: policy.description,
        blockedInputMessaging: 'I cannot process this request as it contains sensitive information or inappropriate content.',
        blockedOutputsMessaging: 'I cannot provide this response as it may contain sensitive information or inappropriate financial advice.',
        
        // Content Policy Configuration
        contentPolicyConfig: policy.contentPolicyConfig,
        
        // Sensitive Information Policy Configuration
        sensitiveInformationPolicyConfig: policy.sensitiveInformationPolicyConfig,
        
        // Topic Policy Configuration
        topicPolicyConfig: policy.topicPolicyConfig,
        
        // Word Policy Configuration
        wordPolicyConfig: policy.wordPolicyConfig,
        
        // Contextual Grounding Policy Configuration
        contextualGroundingPolicyConfig: policy.contextualGroundingPolicyConfig,
      });

      const createResponse = await client.send(createCommand);
      guardrailId = createResponse.guardrailId;
      
      console.log(`✅ Created guardrail: ${guardrailId}`);
      console.log(`📍 Guardrail ARN: ${createResponse.guardrailArn}`);
    }

    // Create a version of the guardrail
    console.log('📦 Creating guardrail version...');
    
    const versionCommand = new CreateGuardrailVersionCommand({
      guardrailIdentifier: guardrailId,
      description: `Version ${policy.version} - ${new Date().toISOString()}`,
    });

    const versionResponse = await client.send(versionCommand);
    
    console.log(`✅ Created guardrail version: ${versionResponse.version}`);
    
    // Build ARN from the response data
    const region = process.env.AWS_REGION || 'us-east-1';
    const accountId = process.env.AWS_ACCOUNT_ID || 'ACCOUNT_ID';
    const guardrailArn = `arn:aws:bedrock:${region}:${accountId}:guardrail/${guardrailId}`;
    
    console.log(`📍 Version ARN: ${guardrailArn}`);

    // Output environment variables for use in deployment
    console.log('\n🔧 Environment Variables for Deployment:');
    console.log(`BEDROCK_GUARDRAIL_ID=${guardrailId}`);
    console.log(`BEDROCK_GUARDRAIL_VERSION=${versionResponse.version}`);
    console.log(`BEDROCK_GUARDRAIL_ARN=${guardrailArn}`);

    // Save deployment info
    const deploymentInfo = {
      guardrailId,
      version: versionResponse.version,
      arn: guardrailArn,
      deployedAt: new Date().toISOString(),
      policyVersion: policy.version,
    };

    const deploymentInfoPath = path.join(__dirname, '../guardrails/deployment-info.json');
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`💾 Deployment info saved to: ${deploymentInfoPath}`);

    console.log('\n🎉 Guardrails deployment completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Update your CDK stack with the guardrail ID and version');
    console.log('2. Deploy your infrastructure: npm run cdk:deploy');
    console.log('3. Test the guardrails: npm run test:guardrails');
    console.log('4. Update Lambda environment variables if needed');

  } catch (error) {
    console.error('❌ Guardrails deployment failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('AccessDenied')) {
        console.log('\n💡 Troubleshooting:');
        console.log('• Ensure your AWS credentials have Bedrock permissions');
        console.log('• Check that Bedrock service is available in your region');
        console.log('• Verify that your account has access to Bedrock Guardrails');
      } else if (error.message.includes('ValidationException')) {
        console.log('\n💡 Troubleshooting:');
        console.log('• Check the guardrails policy format');
        console.log('• Ensure all required fields are present');
        console.log('• Verify that the policy values are within allowed limits');
      }
    }
    
    throw error;
  }
}

/**
 * Validate guardrails policy before deployment
 */
function validatePolicy(policy: GuardrailPolicy): void {
  console.log('🔍 Validating guardrails policy...');

  // Check required fields
  const requiredFields = ['name', 'description', 'version'];
  for (const field of requiredFields) {
    if (!policy[field as keyof GuardrailPolicy]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate content policy
  if (policy.contentPolicyConfig?.filtersConfig) {
    for (const filter of policy.contentPolicyConfig.filtersConfig) {
      if (!['PROMPT_ATTACK', 'JAILBREAK'].includes(filter.type)) {
        throw new Error(`Invalid content filter type: ${filter.type}`);
      }
      if (!['LOW', 'MEDIUM', 'HIGH'].includes(filter.inputStrength)) {
        throw new Error(`Invalid input strength: ${filter.inputStrength}`);
      }
    }
  }

  // Validate PII entities
  if (policy.sensitiveInformationPolicyConfig?.piiEntitiesConfig) {
    for (const entity of policy.sensitiveInformationPolicyConfig.piiEntitiesConfig) {
      if (!['BLOCK', 'ANONYMIZE'].includes(entity.action)) {
        throw new Error(`Invalid PII action: ${entity.action}`);
      }
    }
  }

  // Validate topics
  if (policy.topicPolicyConfig?.topicsConfig) {
    for (const topic of policy.topicPolicyConfig.topicsConfig) {
      if (!['DENY'].includes(topic.type)) {
        throw new Error(`Invalid topic type: ${topic.type}`);
      }
      if (!topic.examples || topic.examples.length === 0) {
        throw new Error(`Topic ${topic.name} must have examples`);
      }
    }
  }

  console.log('✅ Policy validation passed');
}

/**
 * Main deployment function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting Bedrock Guardrails Deployment\n');

  try {
    // Load and validate policy
    const policyPath = path.join(__dirname, '../guardrails/policy.json');
    const policy: GuardrailPolicy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    
    validatePolicy(policy);
    
    // Deploy guardrails
    await deployGuardrails();
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Run deployment if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { deployGuardrails, validatePolicy };