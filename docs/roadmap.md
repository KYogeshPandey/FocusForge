# FocusForge Technical Roadmap & Future Architecture

This document outlines the planned infrastructure and feature expansions for FocusForge post-v1 launch.

---

## 1. Password Reset & Email Verification System

### Architectural Overview
FocusForge v1 uses argon2/bcrypt password hashing with dual-token JWT auth (15-minute in-memory access token + rotating httpOnly refresh token cookie).
In v1.1, automated password recovery and email verification will be introduced without storing plain recovery credentials.

### Data Model (`Token` Collection)
```typescript
interface ITokenDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: 'PASSWORD_RESET' | 'EMAIL_VERIFICATION';
  tokenHash: string; // SHA-256 hash of the 32-byte crypto random token
  expiresAt: Date;   // TTL index: 60 minutes for reset, 24 hours for verification
  usedAt?: Date;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}
```

### MongoDB Indexing Strategy
- `{ tokenHash: 1 }` (unique)
- `{ userId: 1, type: 1 }`
- `{ expiresAt: 1 }` with `expireAfterSeconds: 0` (automatic MongoDB document cleanup)

### Delivery Provider
- **Provider:** [Resend](https://resend.com) (or AWS SES for high volume).
- **Template System:** React Email templates rendered to clean, responsive HTML with plain-text fallback.
- **DKIM & SPF:** Dedicated domain authentication with DMARC reporting.

### Rate Limiting & Abuse Protection
1. **IP Limiter:** Max 5 password reset requests per 15 minutes per IP.
2. **Email Target Limiter:** Max 3 reset emails per 24 hours per target account.
3. **Constant-Time Response:** The endpoint `POST /api/v1/auth/forgot-password` returns `{ success: true, message: "If an account exists, instructions have been sent" }` regardless of whether the email was registered (preventing user enumeration).
4. **Token Invalidation on Password Change:** Changing a password revokes all existing refresh tokens and active password-reset tokens for that user.

---

## 2. Additional Planned Enhancements

### Calendar & Schedule Integrations (v1.2)
- Two-way Google Calendar / iCal subscription feed for planned study blocks.
- Real-time notification chime synchronization with OS notifications via Web Notifications API.

### Collaborative & Group Study Sessions (v1.3)
- Peer study rooms with synchronized Pomodoro timers over WebSockets (Socket.io).
- Shared group goals and study room activity feeds without exposing private personal notes.

### Native Mobile Companion (v1.4)
- React Native / Expo wrapper sharing `@focusforge/shared` contracts and API client.
- Background timer execution with native push notifications.
