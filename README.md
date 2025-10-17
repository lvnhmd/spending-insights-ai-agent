# Spending Insights AI Agent

An autonomous AI agent that transforms messy spending data into actionable weekly money wins for women and moms. Built with AWS Bedrock AgentCore, this system analyzes financial patterns, detects fees, and provides personalized savings recommendations with minimal human intervention.

## 🏗️ Project Structure

```
.
├── app/                    # Next.js web application
├── infra/                  # AWS CDK infrastructure
│   ├── agent/             # AgentCore configuration
│   ├── bin/               # CDK app entry point
│   └── lib/               # CDK stack definitions
├── scripts/               # Deployment and utility scripts
├── guardrails/            # Bedrock Guardrails policies
├── docs/                  # Architecture and documentation
├── cache/                 # Cached API responses for demo
└── Makefile              # One-liner deployment commands
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- AWS CDK CLI: `npm install -g aws-cdk`
- $100 AWS credits activated in your account

### Setup Instructions

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd spending-insights-ai-agent
   make install
   ```

2. **Bootstrap CDK (First Time Only)**
   ```bash
   make bootstrap
   ```

3. **Deploy Infrastructure**
   ```bash
   make deploy
   ```

4. **Deploy Guardrails (Security)**
   ```bash
   npx ts-node scripts/deploy-guardrails.ts
   ```

5. **Verify Deployment**
   ```bash
   # Check stack outputs
   cd infra && npx cdk list
   ```

5. **Destroy Infrastructure (When Done)**
   ```bash
   make destroy
   ```

## 🏛️ Architecture

This project uses AWS Bedrock AgentCore with the following primitives:
- **Memory Management**: Session context and user preference persistence
- **Tool Orchestration**: Action Groups for multi-step financial analysis

### Core AWS Services
- **AWS Bedrock**: Claude 3.5 Sonnet/Haiku and Amazon Nova models
- **Bedrock AgentCore**: Agent orchestration and memory management
- **DynamoDB**: Transaction storage and agent memory
- **Lambda**: Serverless processing functions
- **S3**: CSV uploads and processed data storage
- **EventBridge**: Autonomous weekly analysis triggers

## 🤖 Agent Capabilities

### Autonomous Operations
- **Weekly Analysis**: Automatic Sunday 6 AM insights generation
- **Fee Detection**: Real-time subscription and fee identification
- **Smart Categorization**: Self-learning transaction categorization
- **Savings Recommendations**: Impact-prioritized money-saving suggestions

### Security & Compliance ✅ IMPLEMENTED
- **Bedrock Guardrails**: Comprehensive PII redaction and financial advice protection
  - 🛡️ **PII Protection**: Credit cards BLOCKED, bank accounts ANONYMIZED
  - 🚫 **Financial Advice Blocking**: Prevents specific investment recommendations
  - 🔒 **Content Filtering**: Prompt attack and jailbreak protection
  - ✅ **14/14 test cases passing** - Run `npx ts-node guardrails/test-sensitive-data.ts`
- **Least Privilege IAM**: Minimal required permissions
- **Data Encryption**: S3 and DynamoDB encryption at rest
- **Audit Trail**: All guardrail actions logged for compliance

## 📊 Demo Features

- CSV transaction upload and processing
- AI-powered spending pattern analysis
- Autonomous weekly insights generation
- "Why this recommendation?" explanations
- Real-time fee and subscription detection
- Investment readiness education (not advice)

## 🛠️ Development Commands

```bash
# Install all dependencies
make install

# Build infrastructure
make build

# Deploy to AWS
make deploy

# Check deployment diff
make diff

# Destroy infrastructure
make destroy

# Seed database (to be implemented)
make seed
```

## 📋 Hackathon Compliance

### Technical Requirements ✅
- ✅ AWS Bedrock/SageMaker AI for LLM hosting
- ✅ Amazon Bedrock AgentCore primitives
- ✅ Autonomous AI agent capabilities
- ✅ External API integrations (Plaid, Alpha Vantage)
- ✅ AWS infrastructure deployment

### Judging Criteria Focus
- **Potential Value/Impact**: Solving real financial management pain points
- **Technical Execution**: Well-architected AWS AI solution
- **Functionality**: Working autonomous agent with reasoning
- **Demo Presentation**: End-to-end agentic workflow

## 🔒 Cost Controls

- Budget alerts at $50 and $75 thresholds
- Lambda timeout limits (25-30 seconds)
- DynamoDB on-demand pricing
- Cached API responses for demo reliability
- Easy teardown with `make destroy`

## 📝 License

ISC License - Hackathon Project

---

**⚠️ Important**: This is educational software for hackathon demonstration. Not financial advice. Consult licensed financial advisors for investment decisions.
