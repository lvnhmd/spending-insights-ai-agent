#!/usr/bin/env ts-node

/**
 * Register Bedrock AgentCore
 * Requirements: 7.2, 7.3
 * 
 * This script creates and configures the Bedrock Agent with:
 * - Memory Management primitive
 * - Action Groups for tool orchestration
 * - Proper IAM permissions
 */

import { 
  BedrockAgentClient, 
  CreateAgentCommand, 
  CreateAgentActionGroupCommand,
  PrepareAgentCommand,
  GetAgentCommand,
  UpdateAgentCommand,
  CreateAgentAliasCommand,
  ListAgentsCommand
} from '@aws-sdk/client-bedrock-agent';
import { readFileSync } from 'fs';
import { join } from 'path';

const bedrockAgentClient = new BedrockAgentClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface AgentConfig {
  agentName: string;
  description: string;
  foundationModel: string;
  instruction: string;
  memoryConfiguration: {
    enabledMemoryTypes: string[];
    storageDays: number;
  };
  actionGroups: Array<{
    actionGroupName: string;
    description: string;
    actionGroupExecutor: {
      lambda: string;
    };
  }>;
}

async function registerAgent() {
  try {
    console.log('🚀 Starting Bedrock Agent registration...');

    // Load agent configuration
    const configPath = join(__dirname, '../infra/agent/agent-config.json');
    const agentConfig: AgentConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

    // Get Lambda ARN from environment or CDK outputs
    const lambdaArn = process.env.API_HANDLER_LAMBDA_ARN || 
                     `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:function:spending-insights-api-handler`;

    // Get IAM role ARN
    const roleArn = process.env.BEDROCK_AGENT_ROLE_ARN ||
                   `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/SpendingInsightsStack-BedrockAgentRole*`;

    console.log('📋 Configuration:');
    console.log(`  Agent Name: ${agentConfig.agentName}`);
    console.log(`  Foundation Model: ${agentConfig.foundationModel}`);
    console.log(`  Lambda ARN: ${lambdaArn}`);
    console.log(`  Role ARN: ${roleArn}`);

    // Check if agent already exists
    let agentId: string | undefined;
    try {
      const listResponse = await bedrockAgentClient.send(new ListAgentsCommand({}));
      const existingAgent = listResponse.agentSummaries?.find(
        agent => agent.agentName === agentConfig.agentName
      );
      
      if (existingAgent) {
        agentId = existingAgent.agentId;
        console.log(`✅ Found existing agent: ${agentId}`);
      }
    } catch (error) {
      console.log('ℹ️  No existing agent found, will create new one');
    }

    // Create or update agent
    if (!agentId) {
      console.log('🔨 Creating new Bedrock Agent...');
      
      const createAgentResponse = await bedrockAgentClient.send(new CreateAgentCommand({
        agentName: agentConfig.agentName,
        description: agentConfig.description,
        foundationModel: agentConfig.foundationModel,
        instruction: agentConfig.instruction,
        agentResourceRoleArn: roleArn,
        idleSessionTtlInSeconds: 1800, // 30 minutes
        // Memory configuration
        memoryConfiguration: {
          enabledMemoryTypes: ['SESSION_SUMMARY'],
          storageDays: agentConfig.memoryConfiguration.storageDays
        }
      }));

      agentId = createAgentResponse.agent?.agentId;
      console.log(`✅ Created agent: ${agentId}`);
    } else {
      console.log('🔄 Updating existing agent...');
      
      await bedrockAgentClient.send(new UpdateAgentCommand({
        agentId,
        agentName: agentConfig.agentName,
        description: agentConfig.description,
        foundationModel: agentConfig.foundationModel,
        instruction: agentConfig.instruction,
        agentResourceRoleArn: roleArn,
        memoryConfiguration: {
          enabledMemoryTypes: ['SESSION_SUMMARY'],
          storageDays: agentConfig.memoryConfiguration.storageDays
        }
      }));
      
      console.log(`✅ Updated agent: ${agentId}`);
    }

    if (!agentId) {
      throw new Error('Failed to create or get agent ID');
    }

    // Create Action Group
    console.log('🔧 Creating Action Group...');
    
    const actionGroupResponse = await bedrockAgentClient.send(new CreateAgentActionGroupCommand({
      agentId,
      agentVersion: 'DRAFT',
      actionGroupName: 'financial-analysis-tools',
      description: 'Core financial analysis and recommendation tools',
      actionGroupExecutor: {
        lambda: lambdaArn
      },
      apiSchema: {
        payload: readFileSync(join(__dirname, '../infra/agent/action-group-schema.json'), 'utf-8')
      }
    }));

    console.log(`✅ Created Action Group: ${actionGroupResponse.agentActionGroup?.actionGroupId}`);

    // Prepare the agent
    console.log('⚙️  Preparing agent...');
    
    await bedrockAgentClient.send(new PrepareAgentCommand({
      agentId
    }));

    console.log('✅ Agent prepared successfully');

    // Create agent alias for production use
    console.log('🏷️  Creating agent alias...');
    
    const aliasResponse = await bedrockAgentClient.send(new CreateAgentAliasCommand({
      agentId,
      agentAliasName: 'production',
      description: 'Production alias for spending insights agent'
    }));

    console.log(`✅ Created alias: ${aliasResponse.agentAlias?.agentAliasId}`);

    // Output final configuration
    console.log('\n🎉 Agent registration completed successfully!');
    console.log('\n📊 Agent Details:');
    console.log(`  Agent ID: ${agentId}`);
    console.log(`  Agent ARN: arn:aws:bedrock:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:agent/${agentId}`);
    console.log(`  Alias ID: ${aliasResponse.agentAlias?.agentAliasId}`);
    console.log(`  Action Group: ${actionGroupResponse.agentActionGroup?.actionGroupId}`);

    console.log('\n🔗 Next Steps:');
    console.log('1. Test the agent in the Bedrock console');
    console.log('2. Verify tool orchestration works end-to-end');
    console.log('3. Test memory persistence across sessions');
    console.log('4. Create tool call trace logging for demo');

    // Save agent info for later use
    const agentInfo = {
      agentId,
      agentArn: `arn:aws:bedrock:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:agent/${agentId}`,
      aliasId: aliasResponse.agentAlias?.agentAliasId,
      actionGroupId: actionGroupResponse.agentActionGroup?.actionGroupId,
      createdAt: new Date().toISOString()
    };

    // Write to file for reference
    const fs = require('fs');
    fs.writeFileSync(
      join(__dirname, '../infra/agent/agent-info.json'),
      JSON.stringify(agentInfo, null, 2)
    );

    console.log('\n💾 Agent info saved to infra/agent/agent-info.json');

  } catch (error) {
    console.error('❌ Failed to register agent:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      
      // Provide helpful troubleshooting
      if (error.message.includes('AccessDenied')) {
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Ensure Bedrock model access is approved');
        console.log('2. Check IAM permissions for Bedrock Agent operations');
        console.log('3. Verify AWS credentials are configured correctly');
      }
      
      if (error.message.includes('ValidationException')) {
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check that the foundation model ID is correct');
        console.log('2. Verify the Lambda function exists and is accessible');
        console.log('3. Ensure the IAM role ARN is valid');
      }
    }
    
    process.exit(1);
  }
}

// Helper function to validate prerequisites
async function validatePrerequisites() {
  console.log('🔍 Validating prerequisites...');
  
  const requiredEnvVars = [
    'AWS_REGION',
    'AWS_ACCOUNT_ID'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.log('\nSet these variables:');
    missing.forEach(envVar => {
      console.log(`  export ${envVar}=<value>`);
    });
    process.exit(1);
  }
  
  // Check if required files exist
  const requiredFiles = [
    '../infra/agent/agent-config.json',
    '../infra/agent/action-group-schema.json'
  ];
  
  const fs = require('fs');
  const missingFiles = requiredFiles.filter(file => {
    const fullPath = join(__dirname, file);
    return !fs.existsSync(fullPath);
  });
  
  if (missingFiles.length > 0) {
    console.error(`❌ Missing required files: ${missingFiles.join(', ')}`);
    process.exit(1);
  }
  
  console.log('✅ Prerequisites validated');
}

// Run if called directly
if (require.main === module) {
  validatePrerequisites().then(() => {
    registerAgent();
  });
}

export { registerAgent };