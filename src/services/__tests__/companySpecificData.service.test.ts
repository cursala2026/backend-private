/* eslint-env jest */
import CompanySpecificDataService from '@/services/companySpecificData.service';
import CompanySpecificDataRepository from '@/repositories/companySpecificData.repository';

const mockCompanySpecificDataRepository: any = {
  getAll: jest.fn(),
  updateCompanySpecificData: jest.fn(),
};
let companySpecificDataService: CompanySpecificDataService;
beforeEach(() => {
  jest.clearAllMocks();
  companySpecificDataService = new CompanySpecificDataService(mockCompanySpecificDataRepository);
});
describe('CompanySpecificDataService', () => {
  describe('getAllCompanySpecificData', () => {
    test('returns all company specific data', async () => {
      const mockData = [{ id: '1', privacyPolicy: 'Policy' }];
      mockCompanySpecificDataRepository.getAll.mockResolvedValue(mockData);
      const result = await companySpecificDataService.getAllCompanySpecificData();
      expect(result).toEqual(mockData);
      expect(mockCompanySpecificDataRepository.getAll).toHaveBeenCalled();
    });
    test('throws error on repository failure', async () => {
      mockCompanySpecificDataRepository.getAll.mockRejectedValue(new Error('DB error'));
      await expect(companySpecificDataService.getAllCompanySpecificData()).rejects.toThrow('Error al obtener los datos específicos de la compañía: DB error');
    });
  });
  describe('updateCompanySpecificData', () => {
    test('updates company specific data successfully', async () => {
      const updateData = { privacyPolicy: 'New Policy' };
      const mockUpdated = { id: '1', privacyPolicy: 'New Policy' };
      mockCompanySpecificDataRepository.updateCompanySpecificData.mockResolvedValue(mockUpdated);
      const result = await companySpecificDataService.updateCompanySpecificData('1', updateData);
      expect(result).toEqual(mockUpdated);
      expect(mockCompanySpecificDataRepository.updateCompanySpecificData).toHaveBeenCalledWith('1', updateData);
    });

    test('throws error if privacyPolicy not provided', async () => {
      await expect(companySpecificDataService.updateCompanySpecificData('1', {})).rejects.toThrow('Error al actualizar los datos específicos de la compañía: Debes proporcionar al menos un campo para actualizar.');
    });

    test('throws error if document not found', async () => {
      mockCompanySpecificDataRepository.updateCompanySpecificData.mockResolvedValue(null);
      await expect(companySpecificDataService.updateCompanySpecificData('1', { privacyPolicy: 'Policy' })).rejects.toThrow('No se encontró el documento de datos específicos de la compañía.');
    });

    test('throws error on repository failure', async () => {
      mockCompanySpecificDataRepository.updateCompanySpecificData.mockRejectedValue(new Error('DB error'));
      await expect(companySpecificDataService.updateCompanySpecificData('1', { privacyPolicy: 'Policy' })).rejects.toThrow('Error al actualizar los datos específicos de la compañía: DB error');
    });
  });
});