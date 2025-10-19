/**
 * DynamoDB CRUD operations for user profiles table
 * Requirements: 7.6, 8.1, 1.5
 */

import { PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES, withErrorHandling, generateUserKey } from './dynamodb-client';
import { UserProfile } from '../types';

export interface UserProfileRecord {
  userId: string;
  profileType: string; // Always 'PROFILE'
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
  createdAt: string;
  updatedAt: string;
}

const PROFILE_TYPE = 'PROFILE';

// Create user profile
export async function createUserProfile(profile: UserProfile): Promise<void> {
  const userKey = generateUserKey(profile.userId);
  const now = new Date().toISOString();

  const record: UserProfileRecord = {
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

  await withErrorHandling(async () => {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAMES.USER_PROFILES,
      Item: record,
    }));
  }, 'createUserProfile');
}

// Get user profile
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userKey = generateUserKey(userId);

  const result = await withErrorHandling(async () => {
    return await docClient.send(new GetCommand({
      TableName: TABLE_NAMES.USER_PROFILES,
      Key: {
        userId: userKey,
        profileType: PROFILE_TYPE,
      },
    }));
  }, 'getUserProfile');

  if (!result.Item) {
    return null;
  }

  return recordToUserProfile(result.Item as UserProfileRecord);
}

// Update user profile
export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
  const userKey = generateUserKey(userId);
  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && key !== 'userId' && key !== 'createdAt') {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      
      // Handle date conversion
      if ((key === 'createdAt' || key === 'updatedAt') && value instanceof Date) {
        expressionAttributeValues[attrValue] = value.toISOString();
      } else {
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

  await withErrorHandling(async () => {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAMES.USER_PROFILES,
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
export async function deleteUserProfile(userId: string): Promise<void> {
  const userKey = generateUserKey(userId);

  await withErrorHandling(async () => {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAMES.USER_PROFILES,
      Key: {
        userId: userKey,
        profileType: PROFILE_TYPE,
      },
    }));
  }, 'deleteUserProfile');
}

// Check if user profile exists
export async function userProfileExists(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile !== null;
}

// Get or create default user profile
export async function getOrCreateUserProfile(userId: string): Promise<UserProfile> {
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
export async function updateFinancialGoals(userId: string, goals: string[]): Promise<void> {
  await updateUserProfile(userId, { financialGoals: goals });
}

// Update notification preferences
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<UserProfile['notificationPreferences']>
): Promise<void> {
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
export async function completeOnboarding(userId: string): Promise<void> {
  await updateUserProfile(userId, { onboardingCompleted: true });
}

// Get all user profiles
export async function getAllUserProfiles(): Promise<UserProfile[]> {
  const result = await withErrorHandling(async () => {
    return await docClient.send(new ScanCommand({
      TableName: TABLE_NAMES.USER_PROFILES,
      FilterExpression: 'profileType = :profileType',
      ExpressionAttributeValues: {
        ':profileType': PROFILE_TYPE,
      },
    }));
  }, 'getAllUserProfiles');

  if (!result.Items || result.Items.length === 0) {
    return [];
  }

  return result.Items.map(item => recordToUserProfile(item as UserProfileRecord));
}

// Get all user IDs (lightweight version)
export async function getAllUserIds(): Promise<string[]> {
  const result = await withErrorHandling(async () => {
    return await docClient.send(new ScanCommand({
      TableName: TABLE_NAMES.USER_PROFILES,
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

  return result.Items.map(item => (item as UserProfileRecord).userId.replace('USER#', ''));
}

// Helper function to convert DynamoDB record to UserProfile
function recordToUserProfile(record: UserProfileRecord): UserProfile {
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