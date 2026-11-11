import { z } from 'zod';

export const UserPreferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  focusDuration: z.number().int().min(1).max(180).default(25),
  shortBreakDuration: z.number().int().min(1).max(60).default(5),
  longBreakDuration: z.number().int().min(1).max(90).default(15),
  longBreakInterval: z.number().int().min(1).max(12).default(4),
  soundEnabled: z.boolean().default(true),
  soundVolume: z.number().min(0).max(100).default(70),
  weekStartDay: z.enum(['monday', 'sunday']).default('monday'),
  timezone: z.string().default('UTC'),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const RegisterInputSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name cannot exceed 60 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address').max(120, 'Email cannot exceed 120 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters'),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required').max(100),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(100),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters'),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const UpdateUserMeInputSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  preferences: UserPreferencesSchema.partial().optional(),
});
export type UpdateUserMeInput = z.infer<typeof UpdateUserMeInputSchema>;

export const DeleteAccountInputSchema = z.object({
  password: z.string().min(1, 'Password confirmation is required').max(100),
});
export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  preferences: UserPreferencesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const AuthSuccessDataSchema = z.object({
  user: UserProfileSchema,
  accessToken: z.string(),
});
export type AuthSuccessData = z.infer<typeof AuthSuccessDataSchema>;
