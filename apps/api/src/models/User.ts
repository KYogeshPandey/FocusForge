import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserPreferences {
  theme: 'dark' | 'light' | 'system';
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  soundEnabled: boolean;
  soundVolume: number;
  weekStartDay: 'monday' | 'sunday';
  timezone: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  preferences: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const UserPreferencesSchema = new Schema<IUserPreferences>(
  {
    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    focusDuration: { type: Number, default: 25 },
    shortBreakDuration: { type: Number, default: 5 },
    longBreakDuration: { type: Number, default: 15 },
    longBreakInterval: { type: Number, default: 4 },
    soundEnabled: { type: Boolean, default: true },
    soundVolume: { type: Number, default: 70 },
    weekStartDay: { type: String, enum: ['monday', 'sunday'], default: 'monday' },
    timezone: { type: String, default: 'UTC' },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    preferences: {
      type: UserPreferencesSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = ret['_id']?.toString();
        if (ret['createdAt'] instanceof Date) ret['createdAt'] = ret['createdAt'].toISOString();
        if (ret['updatedAt'] instanceof Date) ret['updatedAt'] = ret['updatedAt'].toISOString();
        delete ret['_id'];
        delete ret['__v'];
        delete ret['passwordHash'];
        return ret;
      },
    },
  }
);

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
