"use strict";
/**
 * Weekly Insights Generator Lambda Function
 * Requirements: 2.1, 2.2, 2.3, 2.4, 7.3, 8.6
 *
 * Handles:
 * - Spending pattern analysis and trend detection
 * - Recommendation generation with impact vs effort prioritization
 * - Post-hoc explanation generation for transparency
 * - Savings calculations and actionable step guidance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const transactions_1 = require("./database/transactions");
const weekly_insights_1 = require("./database/weekly-insights");
const crypto_1 = require("crypto");
const handler = async (event, context) => {
    console.log('Weekly Insights Generator Lambda - Event:', JSON.stringify(event, null, 2));
    try {
        const { userId, weekOf, forceRegenerate = false } = event;
        if (!userId) {
            throw new Error('userId is required');
        }
        // Determine the week to analyze
        const weekDate = weekOf ? new Date(weekOf) : new Date();
        const weekKey = getISOWeekKey(weekDate);
        // Check if insights already exist for this week
        if (!forceRegenerate) {
            const existingInsights = await (0, weekly_insights_1.getWeeklyInsight)(userId, weekDate);
            if (existingInsights) {
                console.log('Returning existing insights for week:', weekKey);
                return {
                    success: true,
                    insights: existingInsights,
                    generated: false,
                    message: 'Existing insights returned'
                };
            }
        }
        // Get transactions for the week
        const transactions = await (0, transactions_1.getTransactionsByWeek)(userId, weekDate);
        if (transactions.length === 0) {
            console.log('No transactions found for week:', weekKey);
            return {
                success: false,
                message: 'No transactions found for the specified week',
                weekKey
            };
        }
        console.log(`Analyzing ${transactions.length} transactions for week ${weekKey}`);
        // Analyze spending patterns
        const spendingPatterns = await analyzeSpendingPatterns(transactions, userId);
        // Calculate category spending
        const categorySpending = calculateCategorySpending(transactions);
        // Identify savings opportunities
        const savingsOpportunities = await identifySavingsOpportunities(transactions, spendingPatterns);
        // Generate recommendations
        const recommendations = await generateRecommendations(savingsOpportunities, categorySpending);
        // Calculate total potential savings
        const potentialSavings = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);
        // Calculate total spent
        const totalSpent = transactions
            .filter(t => t.transactionType === 'debit')
            .reduce((sum, t) => sum + t.amount, 0);
        // Create weekly insight
        const weeklyInsight = {
            id: (0, crypto_1.randomUUID)(),
            userId,
            weekOf: weekDate,
            totalSpent,
            topCategories: categorySpending.slice(0, 5), // Top 5 categories
            recommendations,
            potentialSavings,
            implementedActions: [], // Will be updated when user implements recommendations
            generatedAt: new Date(),
            weekNumber: getISOWeekNumber(weekDate),
            year: weekDate.getFullYear()
        };
        // Store insights in database
        await (0, weekly_insights_1.createWeeklyInsight)(weeklyInsight);
        console.log(`Generated insights for week ${weekKey}: ${recommendations.length} recommendations, $${potentialSavings.toFixed(2)} potential savings`);
        return {
            success: true,
            insights: weeklyInsight,
            generated: true,
            message: `Generated ${recommendations.length} recommendations with $${potentialSavings.toFixed(2)} potential savings`
        };
    }
    catch (error) {
        console.error('Weekly Insights Generator Error:', error);
        throw error;
    }
};
exports.handler = handler;
/**
 * Analyze spending patterns and trends
 */
async function analyzeSpendingPatterns(transactions, userId) {
    // Group transactions by category
    const categoryGroups = transactions.reduce((groups, transaction) => {
        const category = transaction.category;
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(transaction);
        return groups;
    }, {});
    const patterns = [];
    for (const [category, categoryTransactions] of Object.entries(categoryGroups)) {
        const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
        const weeklyAverage = totalAmount; // This week's spending
        // Simple trend analysis (in real implementation, would compare with historical data)
        const trend = 'stable'; // Mock trend for now
        const trendPercentage = 0;
        // Identify unusual transactions (amounts significantly higher than average)
        const amounts = categoryTransactions.map(t => t.amount);
        const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
        const unusualTransactions = categoryTransactions.filter(t => t.amount > avgAmount * 2);
        patterns.push({
            category,
            weeklyAverage,
            trend,
            trendPercentage,
            unusualTransactions
        });
    }
    return patterns.sort((a, b) => b.weeklyAverage - a.weeklyAverage);
}
/**
 * Calculate spending by category
 */
function calculateCategorySpending(transactions) {
    const categoryTotals = transactions.reduce((totals, transaction) => {
        if (transaction.transactionType === 'debit') { // Only count expenses
            const category = transaction.category;
            if (!totals[category]) {
                totals[category] = {
                    category,
                    totalAmount: 0,
                    transactionCount: 0,
                    amounts: []
                };
            }
            totals[category].totalAmount += transaction.amount;
            totals[category].transactionCount += 1;
            totals[category].amounts.push(transaction.amount);
        }
        return totals;
    }, {});
    const totalSpent = Object.values(categoryTotals).reduce((sum, cat) => sum + cat.totalAmount, 0);
    return Object.values(categoryTotals)
        .map(cat => ({
        category: cat.category,
        totalAmount: cat.totalAmount,
        transactionCount: cat.transactionCount,
        averageAmount: cat.totalAmount / cat.transactionCount,
        percentOfTotal: totalSpent > 0 ? (cat.totalAmount / totalSpent) * 100 : 0
    }))
        .sort((a, b) => b.totalAmount - a.totalAmount);
}
/**
 * Identify savings opportunities
 */
async function identifySavingsOpportunities(transactions, patterns) {
    const opportunities = [];
    // 1. Identify subscription fees
    const subscriptions = transactions.filter(t => t.isRecurring &&
        (t.description.toLowerCase().includes('subscription') ||
            t.description.toLowerCase().includes('netflix') ||
            t.description.toLowerCase().includes('spotify') ||
            t.description.toLowerCase().includes('monthly')));
    for (const sub of subscriptions) {
        opportunities.push({
            type: 'subscription',
            description: `Review ${sub.merchantName || sub.description} subscription`,
            potentialSavings: sub.amount * 12, // Annualized
            difficulty: 'easy',
            category: sub.category,
            transactions: [sub],
            reasoning: `This recurring charge of $${sub.amount} could save $${(sub.amount * 12).toFixed(2)} annually if cancelled`
        });
    }
    // 2. Identify bank fees
    const fees = transactions.filter(t => t.category === 'Fees' ||
        t.description.toLowerCase().includes('fee') ||
        t.description.toLowerCase().includes('charge'));
    for (const fee of fees) {
        opportunities.push({
            type: 'fee',
            description: `Eliminate ${fee.description} fee`,
            potentialSavings: fee.amount * 12, // Assume monthly occurrence
            difficulty: 'medium',
            category: fee.category,
            transactions: [fee],
            reasoning: `Bank fees like this $${fee.amount} charge can often be avoided by changing account types or banking habits`
        });
    }
    // 3. Identify category overspending
    const highSpendingCategories = patterns.filter(p => p.weeklyAverage > 200); // Arbitrary threshold
    for (const pattern of highSpendingCategories) {
        const categoryTransactions = transactions.filter(t => t.category === pattern.category);
        opportunities.push({
            type: 'category_overspend',
            description: `Optimize ${pattern.category} spending`,
            potentialSavings: pattern.weeklyAverage * 0.2 * 52, // 20% reduction annualized
            difficulty: 'medium',
            category: pattern.category,
            transactions: categoryTransactions,
            reasoning: `You spent $${pattern.weeklyAverage.toFixed(2)} on ${pattern.category} this week. A 20% reduction could save $${(pattern.weeklyAverage * 0.2 * 52).toFixed(2)} annually`
        });
    }
    // 4. Identify duplicate or similar charges
    const duplicates = findDuplicateTransactions(transactions);
    if (duplicates.length > 0) {
        opportunities.push({
            type: 'duplicate',
            description: 'Review potential duplicate charges',
            potentialSavings: duplicates.reduce((sum, t) => sum + t.amount, 0),
            difficulty: 'easy',
            transactions: duplicates,
            reasoning: `Found ${duplicates.length} potentially duplicate transactions totaling $${duplicates.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}`
        });
    }
    return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
}
/**
 * Generate actionable recommendations from savings opportunities
 */
async function generateRecommendations(opportunities, categorySpending) {
    const recommendations = [];
    // Limit to top 5 opportunities to avoid overwhelming the user
    const topOpportunities = opportunities.slice(0, 5);
    for (let i = 0; i < topOpportunities.length; i++) {
        const opportunity = topOpportunities[i];
        const recommendation = {
            id: (0, crypto_1.randomUUID)(),
            type: mapOpportunityTypeToRecommendationType(opportunity.type),
            title: opportunity.description,
            description: generateDetailedDescription(opportunity),
            potentialSavings: opportunity.potentialSavings,
            difficulty: opportunity.difficulty,
            priority: topOpportunities.length - i, // Higher priority for higher savings
            actionSteps: generateActionSteps(opportunity),
            reasoning: opportunity.reasoning,
            category: opportunity.category,
            confidence: calculateConfidence(opportunity),
            estimatedTimeToImplement: estimateImplementationTime(opportunity),
            impact: categorizeImpact(opportunity.potentialSavings)
        };
        recommendations.push(recommendation);
    }
    // Add a general savings recommendation if we have high spending categories
    const topCategory = categorySpending[0];
    if (topCategory && topCategory.totalAmount > 100) {
        recommendations.push({
            id: (0, crypto_1.randomUUID)(),
            type: 'save',
            title: `Track ${topCategory.category} spending more closely`,
            description: `You spent $${topCategory.totalAmount.toFixed(2)} on ${topCategory.category} this week (${topCategory.percentOfTotal.toFixed(1)}% of total spending). Consider setting a weekly budget for this category.`,
            potentialSavings: topCategory.totalAmount * 0.15 * 52, // 15% reduction annualized
            difficulty: 'easy',
            priority: 3,
            actionSteps: [
                `Set a weekly budget of $${(topCategory.totalAmount * 0.85).toFixed(2)} for ${topCategory.category}`,
                'Track spending in this category daily',
                'Look for alternatives or ways to reduce costs',
                'Review progress weekly'
            ],
            reasoning: `This is your highest spending category. Small reductions here can have significant impact.`,
            category: topCategory.category,
            confidence: 0.8,
            estimatedTimeToImplement: '10 minutes',
            impact: 'medium'
        });
    }
    return recommendations.sort((a, b) => b.priority - a.priority);
}
/**
 * Helper functions
 */
function mapOpportunityTypeToRecommendationType(type) {
    switch (type) {
        case 'subscription':
        case 'fee':
            return 'eliminate_fee';
        case 'category_overspend':
            return 'optimize';
        case 'duplicate':
            return 'save';
        default:
            return 'save';
    }
}
function generateDetailedDescription(opportunity) {
    switch (opportunity.type) {
        case 'subscription':
            return `Review this recurring subscription to determine if it's still providing value. Consider cancelling or downgrading to a cheaper plan.`;
        case 'fee':
            return `This fee can likely be avoided by changing your banking habits or account type. Contact your bank to discuss options.`;
        case 'category_overspend':
            return `Look for ways to reduce spending in this category through budgeting, finding alternatives, or changing habits.`;
        case 'duplicate':
            return `Review these transactions to ensure they're not duplicates or unauthorized charges. Contact your bank if needed.`;
        default:
            return opportunity.description;
    }
}
function generateActionSteps(opportunity) {
    switch (opportunity.type) {
        case 'subscription':
            return [
                'Log into your account or app',
                'Navigate to subscription/billing settings',
                'Cancel or downgrade the subscription',
                'Confirm cancellation via email'
            ];
        case 'fee':
            return [
                'Call your bank or visit a branch',
                'Ask about fee-free account options',
                'Understand what triggers the fee',
                'Set up account alerts to avoid future fees'
            ];
        case 'category_overspend':
            return [
                `Set a weekly budget for ${opportunity.category}`,
                'Track spending in this category daily',
                'Look for cheaper alternatives',
                'Review and adjust weekly'
            ];
        case 'duplicate':
            return [
                'Review the transactions carefully',
                'Contact merchants for any duplicates',
                'Dispute charges with your bank if needed',
                'Monitor future statements closely'
            ];
        default:
            return ['Review the opportunity', 'Take appropriate action'];
    }
}
function calculateConfidence(opportunity) {
    // Simple confidence calculation based on opportunity type
    switch (opportunity.type) {
        case 'subscription':
            return 0.9; // High confidence for subscriptions
        case 'fee':
            return 0.8; // Good confidence for fees
        case 'duplicate':
            return 0.95; // Very high confidence for duplicates
        case 'category_overspend':
            return 0.7; // Medium confidence for spending optimization
        default:
            return 0.6;
    }
}
function estimateImplementationTime(opportunity) {
    switch (opportunity.type) {
        case 'subscription':
            return '5 minutes';
        case 'fee':
            return '15 minutes';
        case 'duplicate':
            return '10 minutes';
        case 'category_overspend':
            return '1 hour';
        default:
            return '10 minutes';
    }
}
function categorizeImpact(potentialSavings) {
    if (potentialSavings < 100)
        return 'low';
    if (potentialSavings < 500)
        return 'medium';
    return 'high';
}
function findDuplicateTransactions(transactions) {
    const duplicates = [];
    const seen = new Map();
    for (const transaction of transactions) {
        // Create a key based on amount, date, and description
        const key = `${transaction.amount}-${transaction.date.toDateString()}-${transaction.description.substring(0, 20)}`;
        if (seen.has(key)) {
            duplicates.push(transaction);
        }
        else {
            seen.set(key, transaction);
        }
    }
    return duplicates;
}
function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
function getISOWeekKey(date) {
    const year = date.getFullYear();
    const week = getISOWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
}
