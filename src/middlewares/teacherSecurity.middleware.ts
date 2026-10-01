import { Request, Response, NextFunction } from 'express';
import { UserRoles, TeacherStatus } from '@/models/enums/user.enum';
import { Course } from '@/models/mongo/course.model';

export const requireActiveTeacher = async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;

    if(!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const isProfessor = user.roles === UserRoles.PROFESOR;
    const isTeacherActive = user.teacherStatus === TeacherStatus.ACTIVE;

    if(!(isProfessor && isTeacherActive)) {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    const courseId = req.params.courseId;
    const course = await Course.findById(courseId);

    if (!course) {
        return res.status(404).json({ message: 'Curso no encontrado' });
    }

    const teacherId = (course.teachers ?? []).map((t: any) => String(t));
    const userId = String(user._id);

    if(!teacherId.includes(userId)) {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    return next();
};
