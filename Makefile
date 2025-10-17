.PHONY: deploy destroy seed install bootstrap

# Install dependencies
install:
	npm install
	cd infra && npm install

# Bootstrap CDK (run once per account/region)
bootstrap:
	cd infra && npx cdk bootstrap

# Build Lambda functions
build-lambdas:
	npx ts-node --project scripts/tsconfig.json scripts/build-lambdas.ts

# Deploy all infrastructure
deploy: build-lambdas
	cd infra && npm run build && npx cdk deploy --all --require-approval never

# Destroy all infrastructure
destroy:
	cd infra && npx cdk destroy --all --force

# Seed database with sample data
seed:
	npm run seed

# Build infra
build:
	cd infra && npm run build

# Check CDK diff
diff:
	cd infra && npx cdk diff

# List CDK stacks
list:
	cd infra && npx cdk list

# Test database operations (unit tests)
test-db:
	npm test -- --testPathPatterns=database-operations.test.ts

# Validate database setup
validate-db:
	npx ts-node --project scripts/tsconfig.json scripts/validate-database-setup.ts

# Test database with sample data (requires deployed tables)
test-db-integration:
	npx ts-node --project scripts/tsconfig.json scripts/test-database-operations.ts

# AgentCore Management Commands

# Upload action group schema to S3
upload-schema:
	npx ts-node --project scripts/tsconfig.json scripts/upload-agent-schema.ts

# Register Bedrock Agent with AgentCore
register-agent:
	npx ts-node --project scripts/tsconfig.json scripts/register-agent.ts

# Test AgentCore memory management
test-memory:
	npx ts-node --project scripts/tsconfig.json scripts/test-memory-management.ts

# Full AgentCore setup (upload schema + register agent)
setup-agentcore: upload-schema register-agent
	@echo "✅ AgentCore setup completed"

# Test AgentCore integration end-to-end
test-agentcore: test-memory
	@echo "✅ AgentCore testing completed"

# Generate demo traces for documentation
generate-demo-traces:
	npx ts-node --project scripts/tsconfig.json scripts/generate-demo-traces.ts

# Validate complete AgentCore integration
validate-agentcore:
	npx ts-node --project scripts/tsconfig.json scripts/validate-agentcore-integration.ts

# Test external API integrations
test-external-apis:
	npx ts-node --project scripts/tsconfig.json scripts/test-external-apis.ts

# Complete AgentCore demo preparation
prepare-demo: setup-agentcore validate-agentcore generate-demo-traces test-external-apis
	@echo "🎬 Demo preparation completed - ready for presentation"