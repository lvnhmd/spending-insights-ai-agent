#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SpendingInsightsStack } from '../lib/spending-insights-stack';

const app = new cdk.App();

new SpendingInsightsStack(app, 'SpendingInsightsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});