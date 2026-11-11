import { z } from 'zod';

export const ThemeSchema = z.enum(['dark', 'light', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

export const WeekStartDaySchema = z.enum(['monday', 'sunday']);
export type WeekStartDay = z.infer<typeof WeekStartDaySchema>;

export const SettingsSchema = z.object({
  theme: ThemeSchema.default('dark'),
  focusDuration: z.number().int().min(1).max(180).default(25), // in minutes
  shortBreakDuration: z.number().int().min(1).max(60).default(5),
  longBreakDuration: z.number().int().min(1).max(90).default(15),
  longBreakInterval: z.number().int().min(1).max(12).default(4),
  soundEnabled: z.boolean().default(true),
  soundVolume: z.number().min(0).max(100).default(70),
  weekStartDay: WeekStartDaySchema.default('monday'),
  timezone: z.string().default('UTC'),
  demoDataLoaded: z.boolean().default(true),
  userName: z.string().default('Alex Rivera'),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const UpdateSettingsInputSchema = SettingsSchema.partial();
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;
