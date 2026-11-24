import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { Task } from '../models/Task.js';
import { StudySession } from '../models/StudySession.js';
import { FocusSession } from '../models/FocusSession.js';
import { Habit } from '../models/Habit.js';
import { HabitCompletion } from '../models/HabitCompletion.js';
import { Goal } from '../models/Goal.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import {
  generateAccessToken,
  generateRefreshTokenString,
  hashToken,
  INACTIVITY_TIMEOUT_MS,
} from '../utils/tokens.js';
import { AppError } from '../utils/AppError.js';
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  UpdateUserMeInput,
  UserProfile,
} from '@focusforge/shared';

export interface AuthResult {
  user: UserProfile;
  accessToken: string;
  refreshTokenString: string;
  expiresAt: Date;
}

export class AuthService {
  /**
   * Registers a new user, creates their initial goal, and generates an auth session
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw AppError.conflict('An account with this email address already exists');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await User.create({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      preferences: {
        theme: 'dark',
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        longBreakInterval: 4,
        soundEnabled: true,
        soundVolume: 70,
        weekStartDay: 'monday',
        timezone: 'UTC',
      },
    });

    // Create default goal
    await Goal.create({
      userId: user._id,
      targetMinutesWeekly: 600,
    });

    // Generate tokens with 72-hour inactivity lifetime
    const now = Date.now();
    const accessToken = generateAccessToken(user._id.toString());
    const refreshTokenString = generateRefreshTokenString();
    const tokenHash = hashToken(refreshTokenString);
    const expiresAt = new Date(now + INACTIVITY_TIMEOUT_MS);
    const lastActiveAt = new Date(now);

    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      lastActiveAt,
    });

    return {
      user: user.toJSON() as unknown as UserProfile,
      accessToken,
      refreshTokenString,
      expiresAt,
    };
  }

  /**
   * Authenticates user with email and password
   */
  async login(input: LoginInput): Promise<AuthResult> {
    const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      // Generic error message to prevent account enumeration
      throw AppError.unauthorized('Invalid email or password');
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const now = Date.now();
    const accessToken = generateAccessToken(user._id.toString());
    const refreshTokenString = generateRefreshTokenString();
    const tokenHash = hashToken(refreshTokenString);
    const expiresAt = new Date(now + INACTIVITY_TIMEOUT_MS);
    const lastActiveAt = new Date(now);

    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      lastActiveAt,
    });

    return {
      user: user.toJSON() as unknown as UserProfile,
      accessToken,
      refreshTokenString,
      expiresAt,
    };
  }

  /**
   * Rotates refresh token with reuse detection while preserving session inactivity deadline
   */
  async refresh(rawRefreshToken?: string): Promise<{ accessToken: string; newRefreshTokenString: string; expiresAt: Date }> {
    if (!rawRefreshToken) {
      throw AppError.unauthorized('Refresh token is required');
    }

    const presentedHash = hashToken(rawRefreshToken);
    const now = new Date();
    const tokenRecord = await RefreshToken.findOne({ tokenHash: presentedHash });

    if (!tokenRecord) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    // Reuse detection: if this token was already revoked, revoke all tokens for this user family
    if (tokenRecord.revokedAt) {
      await RefreshToken.updateMany(
        { userId: tokenRecord.userId },
        { revokedAt: new Date() }
      );
      throw AppError.unauthorized('Refresh token reuse detected. Please log in again.');
    }

    if (tokenRecord.expiresAt.getTime() < now.getTime()) {
      throw AppError.unauthorized('Session expired due to 3 days of inactivity');
    }

    // Revoke old token and rotate
    // Notice: automatic refresh preserves the session's expiresAt and lastActiveAt;
    // it does NOT reset the 72-hour inactivity countdown without user activity.
    const newRefreshTokenString = generateRefreshTokenString();
    const newHash = hashToken(newRefreshTokenString);
    const newExpiresAt = tokenRecord.expiresAt;
    const newLastActiveAt = tokenRecord.lastActiveAt || tokenRecord.createdAt;

    tokenRecord.revokedAt = now;
    tokenRecord.replacedBy = newHash;
    await tokenRecord.save();

    await RefreshToken.create({
      userId: tokenRecord.userId,
      tokenHash: newHash,
      expiresAt: newExpiresAt,
      lastActiveAt: newLastActiveAt,
    });

    const accessToken = generateAccessToken(tokenRecord.userId.toString());

    return {
      accessToken,
      newRefreshTokenString,
      expiresAt: newExpiresAt,
    };
  }

  /**
   * Records user activity atomically, resetting the 72-hour inactivity countdown.
   * Handles concurrent rotation races safely without disabling reuse detection.
   */
  async recordActivity(rawRefreshToken?: string, userId?: string): Promise<{ expiresAt: Date; isRotated: boolean } | null> {
    if (!rawRefreshToken && !userId) {
      throw AppError.unauthorized('Authentication session required');
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + INACTIVITY_TIMEOUT_MS);

    if (rawRefreshToken) {
      const presentedHash = hashToken(rawRefreshToken);

      // 1. Atomic update on active (unrevoked) token that hasn't expired
      const activeRecord = await RefreshToken.findOneAndUpdate(
        {
          tokenHash: presentedHash,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            lastActiveAt: now,
            expiresAt: newExpiresAt,
          },
        },
        { new: true }
      );

      if (activeRecord) {
        return { expiresAt: newExpiresAt, isRotated: false };
      }

      // 2. Check why active token was not updated:
      const existing = await RefreshToken.findOne({ tokenHash: presentedHash });
      if (!existing) {
        throw AppError.unauthorized('Session not found or expired');
      }

      // Check 1: Expired sessions must NEVER be extended by activity
      if (existing.expiresAt.getTime() <= now.getTime()) {
        throw AppError.unauthorized('Session expired due to 3 days of inactivity');
      }

      // Check 2: If revoked, check if it was rotated concurrently (within 30s grace)
      if (existing.revokedAt && existing.replacedBy) {
        const gracePeriodMs = 30 * 1000;
        const timeSinceRevoke = now.getTime() - existing.revokedAt.getTime();

        if (timeSinceRevoke < gracePeriodMs) {
          // Concurrently rotated! Atomically extend the replacement active token
          const replacementRecord = await RefreshToken.findOneAndUpdate(
            {
              tokenHash: existing.replacedBy,
              revokedAt: null,
              expiresAt: { $gt: now },
            },
            {
              $set: {
                lastActiveAt: now,
                expiresAt: newExpiresAt,
              },
            },
            { new: true }
          );

          if (replacementRecord) {
            // Successfully extended the active rotated token!
            // isRotated: true signals that the caller should NOT set a cookie for the old token
            return { expiresAt: newExpiresAt, isRotated: true };
          }
        }
      }

      throw AppError.unauthorized('Session not found or expired');
    }

    // Fallback: authenticated via Bearer token (userId present)
    const activeRecord = await RefreshToken.findOneAndUpdate(
      {
        userId,
        revokedAt: null,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          lastActiveAt: now,
          expiresAt: newExpiresAt,
        },
      },
      { new: true, sort: { createdAt: -1 } }
    );

    if (activeRecord) {
      return { expiresAt: newExpiresAt, isRotated: false };
    }

    const existing = await RefreshToken.findOne({ userId }).sort({ createdAt: -1 });
    if (!existing) {
      throw AppError.unauthorized('Session not found or expired');
    }
    if (existing.expiresAt.getTime() <= now.getTime()) {
      throw AppError.unauthorized('Session expired due to 3 days of inactivity');
    }

    throw AppError.unauthorized('Session not found or expired');
  }

  /**
   * Revokes the provided refresh token on logout
   */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      const hash = hashToken(rawRefreshToken);
      const tokenRecord = await RefreshToken.findOne({ tokenHash: hash });
      if (tokenRecord) {
        tokenRecord.revokedAt = new Date();
        await tokenRecord.save();
        if (tokenRecord.replacedBy) {
          await RefreshToken.updateOne(
            { tokenHash: tokenRecord.replacedBy },
            { revokedAt: new Date() }
          );
        }
      }
    }
  }

  /**
   * Gets current user profile by ID
   */
  async getMe(userId: string): Promise<UserProfile> {
    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return user.toJSON() as unknown as UserProfile;
  }

  /**
   * Updates user name and preferences
   */
  async updateMe(userId: string, input: UpdateUserMeInput): Promise<UserProfile> {
    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (input.name) {
      user.name = input.name;
    }
    if (input.preferences) {
      user.preferences = {
        ...user.preferences,
        ...input.preferences,
      };
    }

    await user.save();
    return user.toJSON() as unknown as UserProfile;
  }

  /**
   * Changes password requiring current password verification
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const isMatch = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw AppError.badRequest('Current password is incorrect');
    }

    user.passwordHash = await hashPassword(input.newPassword);
    await user.save();

    // Revoke existing refresh tokens so other sessions must re-authenticate
    await RefreshToken.updateMany({ userId: user._id }, { revokedAt: new Date() });
  }

  /**
   * Deletes user account and cascades all owned documents
   */
  async deleteAccount(userId: string, passwordConfirm: string): Promise<void> {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const isMatch = await comparePassword(passwordConfirm, user.passwordHash);
    if (!isMatch) {
      throw AppError.badRequest('Incorrect password confirmation');
    }

    // Cascade delete all documents owned by this user
    await Promise.all([
      Task.deleteMany({ userId: user._id }),
      StudySession.deleteMany({ userId: user._id }),
      FocusSession.deleteMany({ userId: user._id }),
      Habit.deleteMany({ userId: user._id }),
      HabitCompletion.deleteMany({ userId: user._id }),
      Goal.deleteMany({ userId: user._id }),
      RefreshToken.deleteMany({ userId: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);
  }
}

export const authService = new AuthService();
