import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISession extends Document {
  userId: Types.ObjectId;
  currentTokenHash: string;
  expiresAt: Date;
  lastActiveAt: Date;
  revokedAt?: Date | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currentTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = (ret['_id'] as Types.ObjectId).toString();
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

SessionSchema.index({ userId: 1, revokedAt: 1 });
SessionSchema.index({ currentTokenHash: 1, revokedAt: 1 });

export const Session: Model<ISession> =
  mongoose.models['Session'] || mongoose.model<ISession>('Session', SessionSchema);
