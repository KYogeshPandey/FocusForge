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

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshTokenString = generateRefreshTokenString();
    const tokenHash = hashToken(refreshTokenString);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    return {
      user: user.toJSON() as unknown as UserProfile,
      accessToken,
      refreshTokenString,
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

    const accessToken = generateAccessToken(user._id.toString());
    const refreshTokenString = generateRefreshTokenString();
    const tokenHash = hashToken(refreshTokenString);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    return {
      user: user.toJSON() as unknown as UserProfile,
      accessToken,
      refreshTokenString,
    };
  }

  /**
   * Rotates refresh token with reuse detection
   */
  async refresh(rawRefreshToken?: string): Promise<{ accessToken: string; newRefreshTokenString: string }> {
    if (!rawRefreshToken) {
      throw AppError.unauthorized('Refresh token is required');
    }

    const presentedHash = hashToken(rawRefreshToken);
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

    if (tokenRecord.expiresAt.getTime() < Date.now()) {
      throw AppError.unauthorized('Refresh token has expired');
    }

    // Revoke old token and rotate
    const newRefreshTokenString = generateRefreshTokenString();
    const newHash = hashToken(newRefreshTokenString);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    tokenRecord.revokedAt = new Date();
    tokenRecord.replacedBy = newHash;
    await tokenRecord.save();

    await RefreshToken.create({
      userId: tokenRecord.userId,
      tokenHash: newHash,
      expiresAt: newExpiresAt,
    });

    const accessToken = generateAccessToken(tokenRecord.userId.toString());

    return {
      accessToken,
      newRefreshTokenString,
    };
  }

  /**
   * Revokes the provided refresh token on logout
   */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      const hash = hashToken(rawRefreshToken);
      await RefreshToken.updateOne({ tokenHash: hash }, { revokedAt: new Date() });
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
