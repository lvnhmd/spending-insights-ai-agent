/**
 * Core data models for the Spending Insights AI Agent
 * Requirements: 1.1, 1.2, 1.4, 6.2
 */

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  subcategory?: string;
  date: Date;
  account: string;
  isRecurring: boolean;
  confidence: number; // AI categorization confidence (0-1)
  originalDescription?: string; // Before PII redaction
  merchantName?: string;
  transactionType: 'debit' | 'credit';
}

export interface CategorySpending {
  category: string;
  subcategory?: string;
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  percentOfTotal: number;
}

export interface WeeklyInsight {
  id: string;
  userId: string;
  weekOf: Date;
  totalSpent: number;
  topCategories: CategorySpending[];
  recommendations: Recommendation[];
  potentialSavings: number;
  implementedActions: string[];
  generatedAt: Date;
  weekNumber: number; // ISO week number
  year: number;
}

export interface Recommendation {
  id: string;
  type: 'save' | 'invest' | 'eliminate_fee' | 'optimize';
  title: string;
  description: string;
  potentialSavings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  priority: number; // 1-10, higher is more important
  actionSteps: string[];
  reasoning: string; // AI's explanation for transparency
  category?: string;
  confidence: number; // 0-1
  estimatedTimeToImplement: string; // e.g., "5 minutes", "1 hour"
  impact: 'low' | 'medium' | 'high';
}

export interface AgentMemory {
  userId: string;
  conversationHistory: ConversationTurn[];
  learnedPreferences: UserPreference[];
  categoryMappings: CategoryMapping[];
  lastAnalysisDate: Date;
  sessionId: string;
}

export interface ConversationTurn {
  id: string;
  type: 'user_input' | 'agent_response' | 'tool_execution' | 'memory_entry';
  timestamp: Date;
  content: any;
  metadata?: {
    sessionId?: string;
    source?: string;
    confidence?: number;
    [key: string]: any;
  };
}

export interface UserPreference {
  id: string;
  type: string;
  value: any;
  confidence: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryMapping {
  id: string;
  pattern: string;
  category: string;
  subcategory?: string;
  confidence: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

// CSV Processing Types
export interface RawTransactionRow {
  date: string;
  description: string;
  amount: string;
  account?: string;
  category?: string;
  type?: string;
}

export interface CSVParseResult {
  transactions: Transaction[];
  errors: CSVParseError[];
  totalRows: number;
  successfulRows: number;
}

export interface CSVParseError {
  row: number;
  field?: string;
  value?: string;
  error: string;
  severity: 'warning' | 'error';
}

// PII Redaction Types
export interface PIIRedactionResult {
  originalText: string;
  redactedText: string;
  redactedFields: PIIField[];
}

export interface PIIField {
  type: 'account_number' | 'card_number' | 'ssn' | 'phone' | 'email' | 'address';
  originalValue: string;
  redactedValue: string;
  startIndex: number;
  endIndex: number;
}

// User Profile Types
export interface UserProfile {
  userId: string;
  email?: string;
  name?: string;
  financialGoals: string[];
  riskTolerance: 'low' | 'medium' | 'high';
  monthlyIncome?: number;
  monthlyBudget?: number;
  preferredCategories: string[];
  notificationPreferences: {
    weeklyInsights: boolean;
    feeAlerts: boolean;
    savingsGoals: boolean;
  };
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}