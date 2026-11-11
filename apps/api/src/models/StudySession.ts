import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IStudySession extends Document {
  userId: Types.ObjectId;
  title: string;
  subject: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  taskId?: Types.ObjectId | null;
  status: 'scheduled' | 'completed' | 'skipped';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudySessionSchema = new Schema<IStudySession>(
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
      maxlength: 100,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 720,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'skipped'],
      default: 'scheduled',
    },
    notes: {
      type: String,
      maxlength: 500,
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

StudySessionSchema.index({ userId: 1, date: 1, startTime: 1 });

export const StudySession: Model<IStudySession> = mongoose.model<IStudySession>(
  'StudySession',
  StudySessionSchema
);
