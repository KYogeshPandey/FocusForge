import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IHabit extends Document {
  userId: Types.ObjectId;
  title: string;
  category: string;
  frequency: 'daily' | 'weekdays' | 'weekends';
  targetPerDay: number;
  color: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HabitSchema = new Schema<IHabit>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekdays', 'weekends'],
      default: 'daily',
    },
    targetPerDay: {
      type: Number,
      default: 1,
      min: 1,
    },
    color: {
      type: String,
      default: '#8B5CF6',
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = (ret['_id'] as Types.ObjectId).toString();
        ret['userId'] = (ret['userId'] as Types.ObjectId).toString();
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

HabitSchema.index({ userId: 1, active: 1 });

export const Habit: Model<IHabit> = mongoose.model<IHabit>('Habit', HabitSchema);
