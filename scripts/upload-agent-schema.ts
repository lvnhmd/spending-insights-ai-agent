#!/usr/bin/env ts-node

/**
 * Upload AgentCore Action Group Schema to S3
 * This script uploads the OpenAPI schema to S3 for Bedrock Agent configuration
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { join } from 'path';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

async function uploadAgentSchema() {
  try {
    // Read the action group schema
    const schemaPath = join(__dirname, '../infra/agent/action-group-schema.json');
    const schemaContent = readFileSync(schemaPath, 'utf-8');

    // Get bucket name from environment or use default pattern
    const bucketName = process.env.DATA_BUCKET || `spending-insights-data-${process.env.AWS_ACCOUNT_ID}-${process.env.AWS_REGION}`;

    console.log(`Uploading action group schema to s3://${bucketName}/agent/action-group-schema.json`);

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: 'agent/action-group-schema.json',
      Body: schemaContent,
      ContentType: 'application/json',
    }));

    console.log('✅ Action group schema uploaded successfully');

  } catch (error) {
    console.error('❌ Failed to upload action group schema:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  uploadAgentSchema();
}

export { uploadAgentSchema };