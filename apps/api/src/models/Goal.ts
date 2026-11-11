import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IGoal extends Document {
  userId: Types.ObjectId;
  targetMinutesWeekly: number;
  targetSessionsWeekly?: number;
  weekStartDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GoalSchema = new Schema<IGoal>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetMinutesWeekly: {
      type: Number,
      required: true,
      default: 600,
      min: 30,
      max: 10080,
    },
    targetSessionsWeekly: {
      type: Number,
      min: 1,
      max: 100,
    },
    weekStartDate: {
      type: String,
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

export const Goal: Model<IGoal> = mongoose.model<IGoal>('Goal', GoalSchema);
