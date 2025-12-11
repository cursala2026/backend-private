import { Connection, Model, Types } from '@/models';
import { IBusinessTraining, BusinessTrainingSchema } from '@/models';

class BusinessTrainingRepository {
  private readonly model: Model<IBusinessTraining>;

  constructor(private readonly connection: Connection) {
      this.model = this.connection.model<IBusinessTraining>(
        'BusinessTraining',
        BusinessTrainingSchema,
        'businesstrainings'
      );
  }

  async findAll(): Promise<IBusinessTraining[]> {
    const res = await this.model.find().exec();
    return res as unknown as IBusinessTraining[];
  }

  async findById(id: string): Promise<IBusinessTraining | null> {
    const objectId = new Types.ObjectId(id);
    const res = await this.model.findById(objectId).exec();
    return res as unknown as IBusinessTraining | null;
  }

  async create(data: Partial<IBusinessTraining>): Promise<IBusinessTraining> {
    const created = await this.model.create(data as Partial<IBusinessTraining>);
    return created as unknown as IBusinessTraining;
  }

  async updateById(id: string, data: Partial<IBusinessTraining>): Promise<IBusinessTraining | null> {
    const objectId = new Types.ObjectId(id);
    const updateQ = data as unknown as import('mongoose').UpdateQuery<IBusinessTraining>;
    const res = await this.model.findByIdAndUpdate(objectId, updateQ, { new: true }).exec();
    return res as unknown as IBusinessTraining | null;
  }

  async deleteById(id: string): Promise<IBusinessTraining | null> {
    const objectId = new Types.ObjectId(id);
    const res = await this.model.findByIdAndDelete(objectId).exec();
    return res as unknown as IBusinessTraining | null;
  }
}

export default BusinessTrainingRepository;
