import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import FileMaterialRepository from '../fileMaterial.repository';
import { FileMaterialSchema, FileMaterialType, FileMaterialCategory } from '@/models/mongo/fileMaterial.model';
import { UserSchema, UserStatus } from '@/models';
import mongoosePaginate from 'mongoose-paginate-v2';

describe('FileMaterialRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repository: FileMaterialRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    mongoose.connection.model('FileMaterial', FileMaterialSchema, 'filematerials');
    mongoose.connection.model('User', UserSchema, 'users');
    
    repository = new FileMaterialRepository(mongoose.connection as any);
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('create and findById', () => {
    it('should create a material and find it populated with uploadedBy', async () => {
      const UserModel = mongoose.connection.model('User');
      const user = await UserModel.create({
        firstName: 'Author',
        lastName: 'Doc',
        username: 'docauthor',
        email: 'doc@test.com',
        password: 'pass'
      });

      const data = {
        name: 'React Guide',
        description: 'Guide to React',
        fileName: 'react_guide.pdf',
        originalFileName: 'react_guide_orig.pdf',
        fileUrl: 'http://docs.com/1',
        fileSize: 1024,
        mimeType: 'application/pdf',
        type: FileMaterialType.EDUCATIONAL_MATERIAL,
        category: FileMaterialCategory.PDF,
        isPublic: true,
        uploadedBy: user._id.toString()
      };

      const created = await repository.create(data);
      expect(created.name).toBe('React Guide');
      expect(created.uploadedBy!.toString()).toBe(user._id.toString());

      const found = await repository.findById(created._id.toString()) as any;
      expect(found).not.toBeNull();
      expect(found.uploadedBy.firstName).toBe('Author');
      expect(found.uploadedBy.email).toBe('doc@test.com');
    });
  });

  describe('findPublicMaterials and findByUser (Pagination)', () => {
    let userId: Types.ObjectId;

    beforeEach(async () => {
      userId = new Types.ObjectId();
      
      const createData = (name: string, isPublic: boolean, type: FileMaterialType) => ({
        name,
        fileName: `${name}.pdf`,
        originalFileName: `${name}_orig.pdf`,
        fileUrl: 'url',
        fileSize: 100,
        mimeType: 'pdf',
        type,
        category: FileMaterialCategory.PDF,
        isPublic,
        uploadedBy: userId.toString()
      });

      await repository.create(createData('Mat 1', true, FileMaterialType.EDUCATIONAL_MATERIAL));
      await repository.create(createData('Mat 2', true, FileMaterialType.EDUCATIONAL_MATERIAL));
      await repository.create(createData('Mat 3', false, FileMaterialType.SUPPORT_DOCUMENT)); // Private
      await repository.create(createData('Mat 4', true, FileMaterialType.TEMPLATE));
    });

    it('should return only public materials with pagination', async () => {
      const res: any = await repository.findPublicMaterials(undefined, undefined, { page: 1, limit: 2 });
      
      expect(res.totalDocs).toBe(3); // Mat 1, 2, 4
      expect(res.docs).toHaveLength(2);
      expect(res.totalPages).toBe(2);
    });

    it('should filter public materials by type', async () => {
      const res: any = await repository.findPublicMaterials(FileMaterialType.TEMPLATE, undefined, { page: 1, limit: 10 });
      
      expect(res.totalDocs).toBe(1);
      expect(res.docs[0].name).toBe('Mat 4');
    });

    it('should return all user materials (public and private)', async () => {
      const res: any = await repository.findByUser(userId.toString(), { page: 1, limit: 10 });
      
      expect(res.totalDocs).toBe(4);
    });
  });

  describe('updateById and deleteById (soft delete)', () => {
    it('should update material data', async () => {
      const data = {
        name: 'Mat',
        fileName: 'm.pdf',
        originalFileName: 'm.pdf',
        fileUrl: 'url',
        fileSize: 10,
        mimeType: 'pdf',
        type: FileMaterialType.EDUCATIONAL_MATERIAL,
        category: FileMaterialCategory.PDF,
        isPublic: true,
        uploadedBy: new Types.ObjectId().toString()
      };

      const created = await repository.create(data);
      const updated = await repository.updateById(created._id.toString(), { name: 'Updated Mat', isPublic: false });
      
      expect(updated!.name).toBe('Updated Mat');
      expect(updated!.isPublic).toBe(false);
    });

    it('should soft delete by setting status to INACTIVE', async () => {
      const data = {
        name: 'ToDelete',
        fileName: 'm.pdf',
        originalFileName: 'm.pdf',
        fileUrl: 'url',
        fileSize: 10,
        mimeType: 'pdf',
        type: FileMaterialType.EDUCATIONAL_MATERIAL,
        category: FileMaterialCategory.PDF,
        isPublic: true,
        uploadedBy: new Types.ObjectId().toString()
      };

      const created = await repository.create(data);
      const deleted = await repository.deleteById(created._id.toString());
      
      expect(deleted!.status).toBe(UserStatus.INACTIVE);

      // Should not be found by public queries
      const isExist = await repository.existsByName('ToDelete');
      expect(isExist).toBe(false);
    });
  });

  describe('incrementDownloadCount and existsByName', () => {
    it('should increment download count', async () => {
      const data = {
        name: 'DlMat',
        fileName: 'm.pdf',
        originalFileName: 'm.pdf',
        fileUrl: 'url',
        fileSize: 10,
        mimeType: 'pdf',
        type: FileMaterialType.EDUCATIONAL_MATERIAL,
        category: FileMaterialCategory.PDF,
        isPublic: true,
        uploadedBy: new Types.ObjectId().toString()
      };

      const created = await repository.create(data);
      expect(created.downloadCount).toBe(0);

      const inc1 = await repository.incrementDownloadCount(created._id.toString());
      expect(inc1!.downloadCount).toBe(1);

      const inc2 = await repository.incrementDownloadCount(created._id.toString());
      expect(inc2!.downloadCount).toBe(2);
    });

    it('should verify existence by name excluding an ID', async () => {
      const data1 = {
        name: 'UniqueName',
        fileName: '1.pdf',
        originalFileName: '1.pdf',
        fileUrl: 'url',
        fileSize: 10,
        mimeType: 'pdf',
        type: FileMaterialType.EDUCATIONAL_MATERIAL,
        category: FileMaterialCategory.PDF,
        isPublic: true,
        uploadedBy: new Types.ObjectId().toString()
      };
      
      const created1 = await repository.create(data1);

      const exists1 = await repository.existsByName('UniqueName');
      expect(exists1).toBe(true);

      const exists2 = await repository.existsByName('UniqueName', created1._id.toString());
      expect(exists2).toBe(false); // excluding itself
    });
  });

  describe('getStats (Aggregation)', () => {
    it('should calculate stats grouping by type and summing downloads', async () => {
      const createData = (name: string) => ({
        name,
        fileName: `${name}.pdf`,
        originalFileName: `${name}_orig.pdf`,
        fileUrl: 'url',
        fileSize: 100,
        mimeType: 'pdf',
        type: FileMaterialType.EDUCATIONAL_MATERIAL,
        category: FileMaterialCategory.PDF,
        isPublic: true,
        uploadedBy: new Types.ObjectId().toString()
      });

      const m1 = await repository.create(createData('Stat 1'));
      const m2 = await repository.create(createData('Stat 2'));
      
      // Simulate downloads
      for(let i=0; i<5; i++) await repository.incrementDownloadCount(m1._id.toString());
      for(let i=0; i<3; i++) await repository.incrementDownloadCount(m2._id.toString());

      const stats = await repository.getStats();
      
      expect(stats.totalMaterials).toBe(2);
      expect(stats.totalDownloads).toBe(8);
    });
  });
});
