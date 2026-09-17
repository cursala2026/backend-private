import { Schema, model, Document, Types } from 'mongoose';

export interface IAttachment {
    title: string;
    fileUrl: string;
    fileType: string;
}

export interface ILesson {
    title: string;
    order: number;
    description?: string;
    videoUrl?: string;
    durationSeconds: number;
    attachments?: IAttachment[];
    isFreePreview: boolean;
}

export interface IModule {
    title: string;
    order: number;
    lessons: ILesson[];
}

export interface ICourse extends Document {
    title: string;
    description: string;
    instructor: Types.ObjectId;
    modality: 'SYNC' | 'ASYNC';
    status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
    thumbnailUrl?: string;
    modules: IModule[];
    createdAt: Date;
    updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
    {
        title: { type: String, required: true, trim: true },
        fileUrl: { type: String, required: true },
        fileType: { type: String, required: true },
    },
    { _id: false }
);

const LessonSchema = new Schema<ILesson>(
    {
        title: { type: String, required: true, maxlength: 100, trim: true },
        order: { type: Number, required: true, min: 1 },    
        description: { type: String, maxlength: 500 },
        videoUrl: { type: String },
        durationSeconds: { type: Number, default: 0 },
        attachments: { type: [AttachmentSchema], default: [] },
        isFreePreview: { type: Boolean, default: false },
    },
    { _id: false }
);

const ModuleSchema = new Schema<IModule>(
    {
        title: { type: String, required: true, maxlength: 100, trim: true },
        order: { type: Number, required: true, min: 1 },
        lessons: { type: [LessonSchema], default: [] },
    },
    { _id: false }
);

const CourseSchema = new Schema<ICourse>(
    {
        title: { type: String, required: true, maxlength: 120, trim: true },
        description: { type: String, required: true, maxlength: 2000 },
        instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        modality: { type: String, required: true, enum: ['SYNC', 'ASYNC'] },
        status: { type: String, enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT' },
        thumbnailUrl: { type: String },
        modules: { type: [ModuleSchema], default: [] },
    },
    { timestamps: true }
);

CourseSchema.index({ instructor: 1, status: 1 });
CourseSchema.index({ modality: 1, status: 1 });

CourseSchema.pre('save', async function () {
    const course = this as ICourse;
    if (['PENDING_REVIEW', 'PUBLISHED'].includes(course.status)) {
        if (!course.modules?.length) {
            throw new Error('El curso debe tener al menos un módulo.');
        }
        const hasValidLesson = course.modules.some((m) => m.lessons.some((l) => {
            if (course.modality === 'ASYNC') {
                return !!l.videoUrl;
            }
            return true;
        }));
        if (!hasValidLesson) {
            throw new Error('El curso debe tener al menos una lección con video.');
        }
    }
});

CourseSchema.pre('validate', async function () {
    const course = this as ICourse;
    const moduleOrders = (course.modules ?? []).map((m) => m.order);
    if (new Set(moduleOrders).size !== moduleOrders.length) {
        throw new Error('Los módulos deben tener un orden único.');
    }
    for (const mod of course.modules ?? []) {
        const lessonOrders = mod.lessons.map((l) => l.order);
        if (new Set(lessonOrders).size !== lessonOrders.length) {
            throw new Error(`Las lecciones del módulo "${mod.title}" deben tener un orden único.`);
        }
    }
});

CourseSchema.set('toJSON', {
    transform: (_doc, ret: any) => {
        delete ret.__v;
        return ret;
    },
});

export const Course = model<ICourse>('Course', CourseSchema);
