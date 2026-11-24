import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  sessionId?: Types.ObjectId | null;
  tokenHash: string;
  expiresAt: Date;
  lastActiveAt: Date;
  firstUsedAt?: Date | null;
  revokedAt?: Date | null;
  replacedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    firstUsedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedBy: {
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
        delete ret['tokenHash'];
        return ret;
      },
    },
  }
);

// TTL index to automatically purge expired tokens from MongoDB
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>(
  'RefreshToken',
  RefreshTokenSchema
);
