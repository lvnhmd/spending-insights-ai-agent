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

# Seed database with sample data (to be implemented)
seed:
	@echo "Seed script to be implemented in scripts/seed.ts"
	# npx ts-node scripts/seed.ts

# Build infra
build:
	cd infra && npm run build

# Check CDK diff
diff:
	cd infra && npx cdk diff

# List CDK stacks
list:
	cd infra && npx cdk list