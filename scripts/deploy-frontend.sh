#!/bin/bash

# Deploy Frontend to AWS S3 + CloudFront
# Usage: ./scripts/deploy-frontend.sh

set -e

echo "🚀 Deploying Spending Insights AI Agent Frontend to AWS..."

# Get the S3 bucket name from CDK outputs
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name SpendingInsightsStack \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name SpendingInsightsStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ Error: Could not find S3 bucket name. Make sure the CDK stack is deployed."
  exit 1
fi

echo "📦 Building Next.js application..."
cd app
npm run build

echo "📤 Uploading to S3 bucket: $BUCKET_NAME"
aws s3 sync out/ s3://$BUCKET_NAME --delete

echo "🔄 Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[0].DomainName=='$BUCKET_NAME.s3.amazonaws.com'].Id" \
  --output text)

if [ ! -z "$DISTRIBUTION_ID" ]; then
  aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*"
  echo "✅ CloudFront cache invalidated"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "🌐 Your public website is available at:"
echo "   $CLOUDFRONT_URL"
echo ""
echo "📊 The autonomous AI agent is running every 4 hours"
echo "🔗 API Gateway: $(aws cloudformation describe-stacks --stack-name SpendingInsightsStack --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)"