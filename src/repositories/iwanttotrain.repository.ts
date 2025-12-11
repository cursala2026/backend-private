import { Connection, Model, Types } from '@/models';
import { IIWantToTrain, IWantToTrainSchema } from '@/models/mongo/iwanttotrain.model';

class IWantToTrainRepository {
  private readonly model: Model<IIWantToTrain>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IIWantToTrain>('IWantToTrain', IWantToTrainSchema, 'iwanttotrain');
  }

  async findAll(): Promise<IIWantToTrain[]> {
    const res = await this.model.find().exec();
    return res as unknown as IIWantToTrain[];
  }

  async findById(id: string): Promise<IIWantToTrain | null> {
    const objectId = new Types.ObjectId(id);
    const res = await this.model.findById(objectId).exec();
    return res as unknown as IIWantToTrain | null;
  }

  async create(data: Partial<IIWantToTrain>): Promise<IIWantToTrain> {
    const created = await this.model.create(data as Partial<IIWantToTrain>);
    return created as unknown as IIWantToTrain;
  }

  async updateById(id: string, data: Partial<IIWantToTrain>): Promise<IIWantToTrain | null> {
    const objectId = new Types.ObjectId(id);
    const updateQ = data as unknown as import('mongoose').UpdateQuery<IIWantToTrain>;
    const res = await this.model.findByIdAndUpdate(objectId, updateQ, { new: true }).exec();
    return res as unknown as IIWantToTrain | null;
  }

  async deleteById(id: string): Promise<IIWantToTrain | null> {
    const objectId = new Types.ObjectId(id);
    const res = await this.model.findByIdAndDelete(objectId).exec();
    return res as unknown as IIWantToTrain | null;
  }
}

export default IWantToTrainRepository;
