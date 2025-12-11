import { Connection, Model, Types } from '@/models';
import { IRequestACourse, RequestACourseSchema } from '@/models/mongo/requestACourse.model';

class RequestACourseRepository {
  private readonly model: Model<IRequestACourse>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IRequestACourse>('RequestACourse', RequestACourseSchema, 'requestacourse');
  }

  async findAll(): Promise<IRequestACourse[]> {
    const res = await this.model.find().exec();
    return res as unknown as IRequestACourse[];
  }

  async findById(id: string): Promise<IRequestACourse | null> {
    const objectId = new Types.ObjectId(id);
    const res = await this.model.findById(objectId).exec();
    return res as unknown as IRequestACourse | null;
  }

  async create(data: Partial<IRequestACourse>): Promise<IRequestACourse> {
    const created = await this.model.create(data as Partial<IRequestACourse>);
    return created as unknown as IRequestACourse;
  }

  async updateById(id: string, data: Partial<IRequestACourse>): Promise<IRequestACourse | null> {
    const objectId = new Types.ObjectId(id);
    const updateQ = data as unknown as import('mongoose').UpdateQuery<IRequestACourse>;
    const res = await this.model.findByIdAndUpdate(objectId, updateQ, { new: true }).exec();
    return res as unknown as IRequestACourse | null;
  }

  async deleteById(id: string): Promise<IRequestACourse | null> {
    const objectId = new Types.ObjectId(id);
    const res = await this.model.findByIdAndDelete(objectId).exec();
    return res as unknown as IRequestACourse | null;
  }
}

export default RequestACourseRepository;
