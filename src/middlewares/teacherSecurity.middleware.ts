import { Request, Response, NextFunction } from 'express';
import { UserRoles, TeacherStatus } from '@/models/enums/user.enum';

export const requireActiveTeacher = (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;

    if(!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const isProfessor = user.roles === UserRoles.PROFESOR;
    const isTeacherActive = user.teacherStatus === TeacherStatus.ACTIVE;

    if(!(isProfessor && isTeacherActive)) {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    return next();
};
