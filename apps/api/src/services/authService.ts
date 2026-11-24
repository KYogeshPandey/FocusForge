import { User } from '../models/User.js';
import { RefreshToken, type IRefreshToken } from '../models/RefreshToken.js';
import { Session, type ISession } from '../models/Session.js';
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
  getRefreshTokenTtlMs,
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

/**
 * Resolves the active terminal token in a multi-generation rotation chain (e.g. A -> B -> C).
 * Starting from the presented token's replacedBy hash, follows replacement pointers.
 * Guarantees:
 * 1. Every token in the chain belongs to the same user and session.
 * 2. Detects cycles and missing intermediate records safely.
 * 3. The terminal token must be unrevoked and unexpired.
 * 4. Rejects chains whose terminal token has been revoked (e.g. by explicit logout).
 * 5. Strictly preserves originRecord's original 30-second grace deadline without resetting it.
 * 6. Validates against future timestamps.
 */
export async function resolveActiveRotationChain(
  originRecord: IRefreshToken,
  now: Date = new Date()
): Promise<IRefreshToken | null> {
  if (!originRecord.replacedBy || !originRecord.revokedAt) {
    return null;
  }

  // Future timestamp validation
  if (originRecord.revokedAt.getTime() > now.getTime()) {
    return null;
  }

  // Preserve the original presented token's 30-second grace deadline
  const GRACE_PERIOD_MS = 30 * 1000;
  const timeSinceRevoke = now.getTime() - originRecord.revokedAt.getTime();
  if (timeSinceRevoke < 0 || timeSinceRevoke >= GRACE_PERIOD_MS) {
    return null;
  }

  // Check stable session if present
  if (originRecord.sessionId) {
    const session = await Session.findById(originRecord.sessionId);
    if (!session || session.revokedAt != null) {
      return null;
    }
  }

  const MAX_CHAIN_DEPTH = 100; // Raised from 25 to support long rotation chains
  let currentHash: string = originRecord.replacedBy;
  const visitedHashes = new Set<string>([originRecord.tokenHash]);

  for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
    // Cycle detection
    if (visitedHashes.has(currentHash)) {
      return null;
    }
    visitedHashes.add(currentHash);

    const currentToken = await RefreshToken.findOne({ tokenHash: currentHash });
    if (!currentToken) {
      // Missing intermediate record in chain
      return null;
    }

    // Cross-user replacement pointer check: every token in chain must belong to same user
    if (currentToken.userId.toString() !== originRecord.userId.toString()) {
      return null;
    }

    // Must not be expired
    if (currentToken.expiresAt.getTime() <= now.getTime()) {
      return null;
    }

    // If current token is unrevoked, it is the active terminal token
    if (!currentToken.revokedAt) {
      return currentToken;
    }

    // If revoked, it must have a replacement pointer to continue the chain
    if (!currentToken.replacedBy) {
      // Terminal token was revoked without replacement (e.g. explicit logout)
      return null;
    }

    currentHash = currentToken.replacedBy;
  }

  return null;
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

    // Generate tokens with persistent lifetime
    const now = Date.now();
    const ttlMs = getRefreshTokenTtlMs();
    const accessToken = generateAccessToken(user._id.toString());
    const refreshTokenString = generateRefreshTokenString();
    const tokenHash = hashToken(refreshTokenString);
    const expiresAt = new Date(now + ttlMs);
    const lastActiveAt = new Date(now);

    const session = await Session.create({
      userId: user._id,
      currentTokenHash: tokenHash,
      expiresAt,
      lastActiveAt,
    });

    await RefreshToken.create({
      userId: user._id,
      sessionId: session._id,
      tokenHash,
      expiresAt,
      lastActiveAt,
      firstUsedAt: lastActiveAt,
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
    const ttlMs = getRefreshTokenTtlMs();
    const accessToken = generateAccessToken(user._id.toString());
    const refreshTokenString = generateRefreshTokenString();
    const tokenHash = hashToken(refreshTokenString);
    const expiresAt = new Date(now + ttlMs);
    const lastActiveAt = new Date(now);

    const session = await Session.create({
      userId: user._id,
      currentTokenHash: tokenHash,
      expiresAt,
      lastActiveAt,
    });

    await RefreshToken.create({
      userId: user._id,
      sessionId: session._id,
      tokenHash,
      expiresAt,
      lastActiveAt,
      firstUsedAt: lastActiveAt,
    });

    return {
      user: user.toJSON() as unknown as UserProfile,
      accessToken,
      refreshTokenString,
      expiresAt,
    };
  }

  /**
   * Rotates refresh token with secure reuse detection and grace period for concurrent rotation races.
   * Rolls the persistent session window forward.
   * Supports lost rotation response recovery without fresh login.
   */
  async refresh(rawRefreshToken?: string): Promise<{
    accessToken: string;
    newRefreshTokenString?: string;
    expiresAt: Date;
  }> {
    if (!rawRefreshToken) {
      throw AppError.unauthorized('Refresh token is required');
    }

    const presentedHash = hashToken(rawRefreshToken);
    const tokenRecord = await RefreshToken.findOne({ tokenHash: presentedHash });

    if (!tokenRecord) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    // Capture comparison timestamp immediately AFTER database read
    const now = new Date();

    // Future timestamp validation
    if (tokenRecord.revokedAt && tokenRecord.revokedAt.getTime() > now.getTime()) {
      throw AppError.unauthorized('Invalid session timestamp');
    }

    // Stable session validation
    let session: ISession | null = null;
    if (tokenRecord.sessionId) {
      session = await Session.findById(tokenRecord.sessionId);
      if (session) {
        if (session.revokedAt) {
          if (session.revokedAt.getTime() > now.getTime()) {
            throw AppError.unauthorized('Invalid session timestamp');
          }
          throw AppError.unauthorized('Session has been revoked');
        }
        if (session.expiresAt.getTime() <= now.getTime()) {
          throw AppError.unauthorized('Session has expired. Please log in again.');
        }
      }
    }

    // Reuse detection with concurrent race grace period & lost response recovery:
    if (tokenRecord.revokedAt) {
      const GRACE_PERIOD_MS = 30 * 1000; // 30-second grace window for concurrent requests/tabs
      const timeSinceRevoke = now.getTime() - tokenRecord.revokedAt.getTime();

      // Case 1: Within concurrency grace window
      if (tokenRecord.replacedBy && timeSinceRevoke >= 0 && timeSinceRevoke < GRACE_PERIOD_MS) {
        const terminalRecord = await resolveActiveRotationChain(tokenRecord, now);

        if (terminalRecord) {
          // Legitimate concurrent request in flight: return fresh access token
          const accessToken = generateAccessToken(terminalRecord.userId.toString());
          return {
            accessToken,
            expiresAt: terminalRecord.expiresAt,
          };
        }

        // Inside grace window, but terminal token is revoked (e.g. by logout) or chain broken
        throw AppError.unauthorized('Session has been revoked');
      }

      // Case 2: Lost Rotation Response Recovery
      // The browser presents tokenRecord, and its successor token was created but NEVER used!
      // This happens when network drops before the browser receives Set-Cookie for the successor.
      if (tokenRecord.replacedBy) {
        const successorToken = await RefreshToken.findOne({
          tokenHash: tokenRecord.replacedBy,
          userId: tokenRecord.userId,
        });

        if (
          successorToken &&
          successorToken.firstUsedAt === null &&
          successorToken.revokedAt === null &&
          (!session || (session.revokedAt === null && session.expiresAt.getTime() > now.getTime()))
        ) {
          // Recover session by rotating to a fresh token and issuing Set-Cookie!
          const recoveredRefreshTokenString = generateRefreshTokenString();
          const recoveredHash = hashToken(recoveredRefreshTokenString);
          const ttlMs = getRefreshTokenTtlMs();
          const newExpiresAt = new Date(now.getTime() + ttlMs);

          // Revoke the lost successor
          successorToken.revokedAt = now;
          successorToken.replacedBy = recoveredHash;
          await successorToken.save();

          // Update current token pointer
          tokenRecord.replacedBy = recoveredHash;
          await tokenRecord.save();

          // Update stable session if present
          if (session) {
            session.currentTokenHash = recoveredHash;
            session.lastActiveAt = now;
            session.expiresAt = newExpiresAt;
            await session.save();
          }

          // Create new active token record
          await RefreshToken.create({
            userId: tokenRecord.userId,
            sessionId: tokenRecord.sessionId || (session ? session._id : null),
            tokenHash: recoveredHash,
            expiresAt: newExpiresAt,
            lastActiveAt: now,
            firstUsedAt: null,
          });

          const accessToken = generateAccessToken(tokenRecord.userId.toString());
          return {
            accessToken,
            newRefreshTokenString: recoveredRefreshTokenString,
            expiresAt: newExpiresAt,
          };
        }
      }

      // Case 3: Genuine reuse outside grace period: revoke entire user family
      await Promise.all([
        RefreshToken.updateMany({ userId: tokenRecord.userId }, { revokedAt: now }),
        Session.updateMany({ userId: tokenRecord.userId }, { revokedAt: now }),
      ]);
      throw AppError.unauthorized('Refresh token reuse detected. Please log in again.');
    }

    if (tokenRecord.expiresAt.getTime() <= now.getTime()) {
      throw AppError.unauthorized('Session has expired. Please log in again.');
    }

    // Mark active token as used
    if (!tokenRecord.firstUsedAt) {
      tokenRecord.firstUsedAt = now;
    }

    const newRefreshTokenString = generateRefreshTokenString();
    const newHash = hashToken(newRefreshTokenString);
    const ttlMs = getRefreshTokenTtlMs();
    const newExpiresAt = new Date(now.getTime() + ttlMs);

    // Atomically claim rotation on Session document if session exists
    if (session) {
      const updatedSession = await Session.findOneAndUpdate(
        {
          _id: session._id,
          currentTokenHash: presentedHash,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            currentTokenHash: newHash,
            lastActiveAt: now,
            expiresAt: newExpiresAt,
          },
        },
        { new: true }
      );

      if (!updatedSession) {
        // Race condition: session was revoked by logout or another concurrent refresh claimed rotation
        const freshSession = await Session.findById(session._id);
        if (!freshSession || freshSession.revokedAt != null) {
          throw AppError.unauthorized('Session has been revoked');
        }
        if (freshSession.expiresAt.getTime() <= now.getTime()) {
          throw AppError.unauthorized('Session has expired. Please log in again.');
        }

        // Another concurrent request claimed rotation on this session.
        // Return fresh access token without emitting a second replacement refresh cookie.
        const accessToken = generateAccessToken(tokenRecord.userId.toString());
        return {
          accessToken,
          expiresAt: freshSession.expiresAt,
        };
      }
    }

    // Successfully claimed rotation: revoke old token and create successor
    tokenRecord.revokedAt = now;
    tokenRecord.replacedBy = newHash;
    await tokenRecord.save();

    await RefreshToken.create({
      userId: tokenRecord.userId,
      sessionId: tokenRecord.sessionId || (session ? session._id : null),
      tokenHash: newHash,
      expiresAt: newExpiresAt,
      lastActiveAt: now,
      firstUsedAt: null, // Initialized as not yet presented
    });

    const accessToken = generateAccessToken(tokenRecord.userId.toString());
    return {
      accessToken,
      newRefreshTokenString,
      expiresAt: newExpiresAt,
    };
  }

  /**
   * Records user activity atomically, extending the persistent session.
   * Handles concurrent rotation races safely without disabling reuse detection.
   * Updates only the session represented by the presented refresh cookie (or its active replacement during grace).
   */
  async recordActivity(rawRefreshToken?: string): Promise<{ expiresAt: Date; isRotated: boolean } | null> {
    if (!rawRefreshToken) {
      throw AppError.unauthorized('Authentication session required');
    }

    const presentedHash = hashToken(rawRefreshToken);
    const tokenRecord = await RefreshToken.findOne({ tokenHash: presentedHash });
    if (!tokenRecord) {
      throw AppError.unauthorized('Session not found or expired');
    }

    // Capture comparison timestamp immediately AFTER database read
    const now = new Date();

    // Future timestamp validation
    if (tokenRecord.revokedAt && tokenRecord.revokedAt.getTime() > now.getTime()) {
      throw AppError.unauthorized('Invalid session timestamp');
    }

    // Check stable session status if sessionId exists
    let session: ISession | null = null;
    if (tokenRecord.sessionId) {
      session = await Session.findById(tokenRecord.sessionId);
      if (session) {
        if (session.revokedAt) {
          if (session.revokedAt.getTime() > now.getTime()) {
            throw AppError.unauthorized('Invalid session timestamp');
          }
          throw AppError.unauthorized('Session has been revoked');
        }
        if (session.expiresAt.getTime() <= now.getTime()) {
          throw AppError.unauthorized('Session has expired. Please log in again.');
        }
      }
    }

    if (tokenRecord.expiresAt.getTime() <= now.getTime()) {
      throw AppError.unauthorized('Session has expired. Please log in again.');
    }

    const ttlMs = getRefreshTokenTtlMs();
    const newExpiresAt = new Date(now.getTime() + ttlMs);

    // 1. Active token: update session and token
    if (!tokenRecord.revokedAt) {
      tokenRecord.lastActiveAt = now;
      tokenRecord.expiresAt = newExpiresAt;
      if (!tokenRecord.firstUsedAt) {
        tokenRecord.firstUsedAt = now;
      }
      await tokenRecord.save();

      if (session) {
        await Session.updateOne(
          { _id: session._id, revokedAt: null, expiresAt: { $gt: now } },
          { $set: { lastActiveAt: now, expiresAt: newExpiresAt } }
        );
      }

      return { expiresAt: newExpiresAt, isRotated: false };
    }

    // 2. Revoked token: check concurrency grace window
    const gracePeriodMs = 30 * 1000;
    const timeSinceRevoke = now.getTime() - tokenRecord.revokedAt.getTime();

    if (tokenRecord.replacedBy && timeSinceRevoke >= 0 && timeSinceRevoke < gracePeriodMs) {
      const terminalRecord = await resolveActiveRotationChain(tokenRecord, now);

      if (terminalRecord && (!session || session.revokedAt == null)) {
        terminalRecord.lastActiveAt = now;
        terminalRecord.expiresAt = newExpiresAt;
        await terminalRecord.save();

        if (terminalRecord.sessionId) {
          await Session.updateOne(
            { _id: terminalRecord.sessionId, revokedAt: null, expiresAt: { $gt: now } },
            { $set: { lastActiveAt: now, expiresAt: newExpiresAt } }
          );
        }

        return { expiresAt: newExpiresAt, isRotated: true };
      }
    }

    throw AppError.unauthorized('Session has been revoked');
  }

  /**
   * Revokes the session and all associated tokens atomically on logout,
   * without affecting unrelated device sessions.
   */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    const hash = hashToken(rawRefreshToken);
    const tokenRecord = await RefreshToken.findOne({ tokenHash: hash });
    if (!tokenRecord) {
      return;
    }

    const now = new Date();
    tokenRecord.revokedAt = now;
    await tokenRecord.save();

    if (tokenRecord.sessionId) {
      // 1. Atomic revocation on stable Session record
      await Session.updateOne(
        { _id: tokenRecord.sessionId },
        { $set: { revokedAt: now } }
      );

      // 2. Atomic revocation of all tokens belonging to this session
      await RefreshToken.updateMany(
        { sessionId: tokenRecord.sessionId },
        { $set: { revokedAt: now } }
      );
    } else {
      // Fallback for standalone/legacy tokens
      if (tokenRecord.replacedBy) {
        await RefreshToken.updateOne(
          { tokenHash: tokenRecord.replacedBy },
          { revokedAt: now }
        );
      }
      await RefreshToken.updateMany(
        { replacedBy: hash },
        { revokedAt: now }
      );
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

    // Revoke existing refresh tokens and stable sessions so other sessions must re-authenticate
    await Promise.all([
      RefreshToken.updateMany({ userId: user._id }, { revokedAt: new Date() }),
      Session.updateMany({ userId: user._id }, { revokedAt: new Date() }),
    ]);
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
      Session.deleteMany({ userId: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);
  }
}

export const authService = new AuthService();
