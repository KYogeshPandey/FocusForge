import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IFocusSession extends Document {
  userId: Types.ObjectId;
  clientSessionId?: string | null;
  title: string;
  subject: string;
  durationMinutes: number;
  startedAt: string; // ISO string
  endedAt: string; // ISO string
  mode: 'focus' | 'short-break' | 'long-break';
  taskId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const FocusSessionSchema = new Schema<IFocusSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientSessionId: {
      type: String,
      default: null,
      sparse: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 720,
    },
    startedAt: {
      type: String,
      required: true,
      index: true,
    },
    endedAt: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      enum: ['focus', 'short-break', 'long-break'],
      default: 'focus',
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = (ret['_id'] as Types.ObjectId).toString();
        ret['userId'] = (ret['userId'] as Types.ObjectId).toString();
        if (ret['taskId']) ret['taskId'] = (ret['taskId'] as Types.ObjectId).toString();
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

FocusSessionSchema.index({ userId: 1, startedAt: -1 });
FocusSessionSchema.index({ userId: 1, clientSessionId: 1 }, { sparse: true });

export const FocusSession: Model<IFocusSession> = mongoose.model<IFocusSession>(
  'FocusSession',
  FocusSessionSchema
);
