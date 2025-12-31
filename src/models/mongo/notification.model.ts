import { Schema, model, ObjectId } from 'mongoose';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface INotification {
  _id?: ObjectId;
  userId: Schema.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationModel extends INotification {}

export const NotificationSchema: Schema<NotificationModel> = new Schema<NotificationModel>(
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
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      default: NotificationType.INFO,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índice compuesto para consultas comunes (userId + isRead + fecha)
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = model<NotificationModel>('Notification', NotificationSchema, 'notifications');

export { Notification };
