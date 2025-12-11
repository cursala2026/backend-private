import { Schema } from 'mongoose';
import { Types } from '@/models';
import generalConnection from '@/config/databases';

// Enum para el estado del código promocional
export enum PromotionalCodeStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  DELETED = 'DELETED',
}

// Enum para el tipo de descuento
export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

// Interface para los códigos promocionales
export interface IPromotionalCode {
  _id?: Types.ObjectId;
  code: string; // Código promocional único (ej: DESCUENTO2024)
  name: string; // Nombre descriptivo (ej: "Descuento Navidad 2024")
  description?: string; // Descripción opcional
  discountType: DiscountType; // Tipo de descuento
  discountValue: number; // Valor del descuento (porcentaje o monto fijo)
  status: PromotionalCodeStatus; // Estado del código

  // Cursos aplicables
  applicableCourses: Types.ObjectId[]; // IDs de cursos donde aplica el código
  isGlobal: boolean; // Si es true, aplica a todos los cursos

  // Fechas de validez
  validFrom?: Date; // Fecha de inicio de validez
  validUntil?: Date; // Fecha de expiración

  // Límites de uso
  maxUses?: number; // Máximo número de usos permitidos
  usedCount: number; // Contador de usos actuales
  maxUsesPerUser?: number; // Máximo de usos por usuario

  // Condiciones adicionales
  minimumPurchaseAmount?: number; // Monto mínimo de compra para aplicar

  // Metadatos
  createdBy: Types.ObjectId; // Usuario que creó el código
  lastModifiedBy?: Types.ObjectId; // Último usuario que modificó el código

  // Historial de uso
  usageHistory?: {
    userId: Types.ObjectId;
    courseId: Types.ObjectId;
    usedAt: Date;
    discountApplied: number; // Monto de descuento aplicado
  }[];

  // Métodos de instancia
  isValid?(): boolean;
  appliesToCourse?(courseId: Types.ObjectId | string): boolean;
  getUserUsageCount?(userId: Types.ObjectId | string): number;
  calculateDiscount?(originalPrice: number): number;
}

export interface PromotionalCodeModel extends IPromotionalCode {}

// Schema para el historial de uso
const UsageHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    usedAt: { type: Date, default: Date.now },
    discountApplied: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// Schema principal para códigos promocionales
export const PromotionalCodeSchema: Schema<any> = new Schema<any>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^[A-Z0-9]+$/,
      minlength: 3,
      maxlength: 20,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    discountType: {
      type: String,
      enum: Object.values(DiscountType),
      required: true,
      default: DiscountType.PERCENTAGE,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        // Usar función non-arrow y `any` para compatibilidad con diferentes firmas de Mongoose
        validator: function (this: any, value: number) {
          // Si es porcentaje, máximo 100%. Si es monto fijo, sin límite específico
          if (this.discountType === DiscountType.PERCENTAGE) {
            return value <= 100;
          }
          return true;
        },
        message: 'El porcentaje de descuento no puede ser mayor a 100%',
      },
    },
    status: {
      type: String,
      enum: Object.values(PromotionalCodeStatus),
      default: PromotionalCodeStatus.ACTIVE,
    },
    applicableCourses: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
      default: [],
    },
    isGlobal: {
      type: Boolean,
      default: false,
    },
    validFrom: {
      type: Date,
    },
    validUntil: {
      type: Date,
    },
    maxUses: {
      type: Number,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUsesPerUser: {
      type: Number,
      min: 1,
      default: 1,
    },
    minimumPurchaseAmount: {
      type: Number,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    usageHistory: {
      type: [UsageHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índices para optimizar consultas
PromotionalCodeSchema.index({ status: 1 });
PromotionalCodeSchema.index({ validFrom: 1, validUntil: 1 });
PromotionalCodeSchema.index({ applicableCourses: 1 });
PromotionalCodeSchema.index({ isGlobal: 1 });

// Método para verificar si el código es válido
type PromoDoc = import('mongoose').HydratedDocument<PromotionalCodeModel>;

PromotionalCodeSchema.methods.isValid = function isValid(this: PromoDoc): boolean {
  if (this.status !== PromotionalCodeStatus.ACTIVE) {
    return false;
  }

  const now = new Date();

  // Verificar fechas de validez
  if (this.validFrom && now < this.validFrom) {
    return false;
  }

  if (this.validUntil && now > this.validUntil) {
    return false;
  }

  // Verificar límite de usos
  if (this.maxUses && this.usedCount >= this.maxUses) {
    return false;
  }

  return true;
};

// Método para verificar si aplica a un curso específico
PromotionalCodeSchema.methods.appliesToCourse = function appliesToCourse(this: PromoDoc, courseId: Types.ObjectId | string): boolean {
  if (this.isGlobal) {
    return true;
  }

    return this.applicableCourses.some((course: Types.ObjectId | { _id?: Types.ObjectId }) => {
    const courseObjectId = (course && typeof (course as { _id?: Types.ObjectId })._id !== 'undefined') ? (course as { _id?: Types.ObjectId })._id : (course as Types.ObjectId);
    return String(courseObjectId) === String(courseId);
  });
};

// Método para verificar usos por usuario
PromotionalCodeSchema.methods.getUserUsageCount = function getUserUsageCount(this: PromoDoc, userId: Types.ObjectId | string): number {
  const history = this.usageHistory ?? [];
  return history.filter((usage) => String(usage.userId) === String(userId)).length;
};

// Método para calcular el descuento
PromotionalCodeSchema.methods.calculateDiscount = function calculateDiscount(this: PromoDoc, originalPrice: number): number {
  if (this.discountType === DiscountType.PERCENTAGE) {
    return Math.round((originalPrice * this.discountValue) / 100);
  }
  // Monto fijo, pero no puede ser mayor al precio original
  return Math.min(this.discountValue, originalPrice);
};

const PromotionalCode = generalConnection.model<PromotionalCodeModel>(
  'PromotionalCode',
  PromotionalCodeSchema,
  'promotionalCodes'
);
export { PromotionalCode };
