import { ObjectId, Types } from '@/models';

export const objectIdToString = (args: ObjectId[]): string[] => args.map((id) => id.toString());
export const stringToObjectId = (args: string[]): Types.ObjectId[] => args.map((id) => new Types.ObjectId(id));
