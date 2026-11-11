import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IHabitCompletion extends Document {
  userId: Types.ObjectId;
  habitId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HabitCompletionSchema = new Schema<IHabitCompletion>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    habitId: {
      type: Schema.Types.ObjectId,
      ref: 'Habit',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    completed: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = (ret['_id'] as Types.ObjectId).toString();
        ret['userId'] = (ret['userId'] as Types.ObjectId).toString();
        ret['habitId'] = (ret['habitId'] as Types.ObjectId).toString();
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

// Enforce single completion record per habit per date per user
HabitCompletionSchema.index({ userId: 1, habitId: 1, date: 1 }, { unique: true });

export const HabitCompletion: Model<IHabitCompletion> = mongoose.model<IHabitCompletion>(
  'HabitCompletion',
  HabitCompletionSchema
);
