"use strict";
/**
 * DynamoDB CRUD operations for user profiles table
 * Requirements: 7.6, 8.1, 1.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserProfile = createUserProfile;
exports.getUserProfile = getUserProfile;
exports.updateUserProfile = updateUserProfile;
exports.deleteUserProfile = deleteUserProfile;
exports.userProfileExists = userProfileExists;
exports.getOrCreateUserProfile = getOrCreateUserProfile;
exports.updateFinancialGoals = updateFinancialGoals;
exports.updateNotificationPreferences = updateNotificationPreferences;
exports.completeOnboarding = completeOnboarding;
exports.getAllUserProfiles = getAllUserProfiles;
exports.getAllUserIds = getAllUserIds;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_client_1 = require("./dynamodb-client");
const PROFILE_TYPE = 'PROFILE';
// Create user profile
async function createUserProfile(profile) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(profile.userId);
    const now = new Date().toISOString();
    const record = {
        userId: userKey,
        profileType: PROFILE_TYPE,
        email: profile.email,
        name: profile.name,
        financialGoals: profile.financialGoals,
        riskTolerance: profile.riskTolerance,
        monthlyIncome: profile.monthlyIncome,
        monthlyBudget: profile.monthlyBudget,
        preferredCategories: profile.preferredCategories,
        notificationPreferences: profile.notificationPreferences,
        onboardingCompleted: profile.onboardingCompleted,
        createdAt: now,
        updatedAt: now,
    };
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.USER_PROFILES,
            Item: record,
        }));
    }, 'createUserProfile');
}
// Get user profile
async function getUserProfile(userId) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.USER_PROFILES,
            Key: {
                userId: userKey,
                profileType: PROFILE_TYPE,
            },
        }));
    }, 'getUserProfile');
    if (!result.Item) {
        return null;
    }
    return recordToUserProfile(result.Item);
}
// Update user profile
async function updateUserProfile(userId, updates) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    const now = new Date().toISOString();
    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'userId' && key !== 'createdAt') {
            const attrName = `#${key}`;
            const attrValue = `:${key}`;
            updateExpressions.push(`${attrName} = ${attrValue}`);
            expressionAttributeNames[attrName] = key;
            // Handle date conversion
            if ((key === 'createdAt' || key === 'updatedAt') && value instanceof Date) {
                expressionAttributeValues[attrValue] = value.toISOString();
            }
            else {
                expressionAttributeValues[attrValue] = value;
            }
        }
    });
    if (updateExpressions.length === 0) {
        return; // Nothing to update
    }
    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.USER_PROFILES,
            Key: {
                userId: userKey,
                profileType: PROFILE_TYPE,
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }));
    }, 'updateUserProfile');
}
// Delete user profile
async function deleteUserProfile(userId) {
    const userKey = (0, dynamodb_client_1.generateUserKey)(userId);
    await (0, dynamodb_client_1.withErrorHandling)(async () => {
        await dynamodb_client_1.docClient.send(new lib_dynamodb_1.DeleteCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.USER_PROFILES,
            Key: {
                userId: userKey,
                profileType: PROFILE_TYPE,
            },
        }));
    }, 'deleteUserProfile');
}
// Check if user profile exists
async function userProfileExists(userId) {
    const profile = await getUserProfile(userId);
    return profile !== null;
}
// Get or create default user profile
async function getOrCreateUserProfile(userId) {
    let profile = await getUserProfile(userId);
    if (!profile) {
        // Create default profile
        profile = {
            userId,
            financialGoals: [],
            riskTolerance: 'medium',
            preferredCategories: [],
            notificationPreferences: {
                weeklyInsights: true,
                feeAlerts: true,
                savingsGoals: true,
            },
            onboardingCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await createUserProfile(profile);
    }
    return profile;
}
// Update financial goals
async function updateFinancialGoals(userId, goals) {
    await updateUserProfile(userId, { financialGoals: goals });
}
// Update notification preferences
async function updateNotificationPreferences(userId, preferences) {
    const currentProfile = await getUserProfile(userId);
    if (currentProfile) {
        const updatedPreferences = {
            ...currentProfile.notificationPreferences,
            ...preferences,
        };
        await updateUserProfile(userId, { notificationPreferences: updatedPreferences });
    }
}
// Mark onboarding as completed
async function completeOnboarding(userId) {
    await updateUserProfile(userId, { onboardingCompleted: true });
}
// Get all user profiles
async function getAllUserProfiles() {
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.ScanCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.USER_PROFILES,
            FilterExpression: 'profileType = :profileType',
            ExpressionAttributeValues: {
                ':profileType': PROFILE_TYPE,
            },
        }));
    }, 'getAllUserProfiles');
    if (!result.Items || result.Items.length === 0) {
        return [];
    }
    return result.Items.map(item => recordToUserProfile(item));
}
// Get all user IDs (lightweight version)
async function getAllUserIds() {
    const result = await (0, dynamodb_client_1.withErrorHandling)(async () => {
        return await dynamodb_client_1.docClient.send(new lib_dynamodb_1.ScanCommand({
            TableName: dynamodb_client_1.TABLE_NAMES.USER_PROFILES,
            FilterExpression: 'profileType = :profileType',
            ExpressionAttributeValues: {
                ':profileType': PROFILE_TYPE,
            },
            ProjectionExpression: 'userId',
        }));
    }, 'getAllUserIds');
    if (!result.Items || result.Items.length === 0) {
        return [];
    }
    return result.Items.map(item => item.userId.replace('USER#', ''));
}
// Helper function to convert DynamoDB record to UserProfile
function recordToUserProfile(record) {
    return {
        userId: record.userId.replace('USER#', ''),
        email: record.email,
        name: record.name,
        financialGoals: record.financialGoals,
        riskTolerance: record.riskTolerance,
        monthlyIncome: record.monthlyIncome,
        monthlyBudget: record.monthlyBudget,
        preferredCategories: record.preferredCategories,
        notificationPreferences: record.notificationPreferences,
        onboardingCompleted: record.onboardingCompleted,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
    };
}
