.PHONY: deploy destroy seed install bootstrap

# Install dependencies
install:
	npm install
	cd infra && npm install

# Bootstrap CDK (run once per account/region)
bootstrap:
	cd infra && npx cdk bootstrap

# Deploy all infrastructure
deploy:
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