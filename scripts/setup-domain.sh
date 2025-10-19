#!/bin/bash

# Setup Custom Domain for Spending Insights AI Agent
# Usage: ./scripts/setup-domain.sh your-domain.com

DOMAIN_NAME=$1

if [ -z "$DOMAIN_NAME" ]; then
  echo "❌ Usage: ./scripts/setup-domain.sh your-domain.com"
  exit 1
fi

echo "🌐 Setting up custom domain: $DOMAIN_NAME"

# Check if domain exists in Route 53
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name $DOMAIN_NAME \
  --query 'HostedZones[0].Id' \
  --output text 2>/dev/null)

if [ "$HOSTED_ZONE_ID" = "None" ] || [ -z "$HOSTED_ZONE_ID" ]; then
  echo "❌ Domain $DOMAIN_NAME not found in Route 53"
  echo "📝 Please:"
  echo "   1. Buy the domain in Route 53, or"
  echo "   2. Transfer existing domain to Route 53, or" 
  echo "   3. Create a hosted zone for your domain"
  exit 1
fi

# Clean up the hosted zone ID (remove /hostedzone/ prefix)
HOSTED_ZONE_ID=$(echo $HOSTED_ZONE_ID | sed 's|/hostedzone/||')

echo "✅ Found hosted zone: $HOSTED_ZONE_ID"
echo "🚀 Deploying with custom domain..."

# Deploy CDK stack with domain parameters
cd infra
npx cdk deploy \
  --parameters domainName=$DOMAIN_NAME \
  --parameters hostedZoneId=$HOSTED_ZONE_ID

echo ""
echo "🎉 Deployment complete!"
echo "🌐 Your website will be available at: https://$DOMAIN_NAME"
echo "⏳ SSL certificate validation may take 5-10 minutes"
echo "🔄 DNS propagation may take up to 48 hours globally"