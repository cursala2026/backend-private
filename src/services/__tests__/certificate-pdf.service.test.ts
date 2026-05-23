import { generateCertificatePDF, CertificatePdfData } from '../certificate-pdf.service';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';

jest.mock('pdfkit');
jest.mock('qrcode');
jest.mock('axios');
jest.mock('sharp');
jest.mock('fs');
jest.mock('@/utils', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('generateCertificatePDF', () => {
  let mockDoc: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PDFDocument
    mockDoc = {
      on: jest.fn((event, cb) => {
        if (event === 'end') {
          // Immediately trigger 'end' to resolve the promise
          setTimeout(() => cb(), 10);
        }
      }),
      end: jest.fn(),
      rect: jest.fn().mockReturnThis(),
      fill: jest.fn().mockReturnThis(),
      image: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      widthOfString: jest.fn().mockReturnValue(100),
      save: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      lineWidth: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      restore: jest.fn().mockReturnThis(),
    };
    (PDFDocument as unknown as jest.Mock).mockImplementation(() => mockDoc);

    // Mock QRCode
    (QRCode.toBuffer as jest.Mock).mockResolvedValue(Buffer.from('qr-code'));

    // Mock Axios
    (axios.get as jest.Mock).mockResolvedValue({
      data: Buffer.from('mock-image-data').buffer
    });

    // Mock Sharp
    const sharpMock = {
      flatten: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('sharp-jpeg-data'))
    };
    (sharp as unknown as jest.Mock).mockReturnValue(sharpMock);

    // Mock FS
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('local-file'));
  });

  it('should generate a certificate PDF successfully with minimal data', async () => {
    const data: CertificatePdfData = {};

    const pdfBuffer = await generateCertificatePDF(data);

    expect(PDFDocument).toHaveBeenCalled();
    expect(mockDoc.end).toHaveBeenCalled();
    expect(QRCode.toBuffer).toHaveBeenCalled();
    // Resolves to an empty buffer because we didn't push anything in `mockDoc.on('data')`
    expect(pdfBuffer).toBeInstanceOf(Buffer);
  });

  it('should generate a certificate with complete data including URLs and partners', async () => {
    const data: CertificatePdfData = {
      student: { firstName: 'John', lastName: 'Doe', dni: '12345678' },
      course: { name: 'Fullstack Dev', duration: 120 },
      teachers: [
        { firstName: 'Jane', lastName: 'Smith', role: 'director', professionalSignatureUrl: 'https://cdn.com/sig1.jpg' },
        { firstName: 'Bob', lastName: 'Ross', role: 'instructor', professionalSignatureUrl: 'local-sig.jpg' }
      ],
      partnerLogos: ['https://cdn.com/logo1.png', 'https://cdn.com/logo2.png']
    };

    const pdfBuffer = await generateCertificatePDF(data);

    // Axios should be called for sig1 and the two partner logos
    expect(axios.get).toHaveBeenCalledTimes(3);
    
    // sharp should be called for the partner logos
    expect(sharp).toHaveBeenCalledTimes(2);

    expect(mockDoc.text).toHaveBeenCalledWith(
      'JOHN DOE',
      expect.any(Number),
      expect.any(Number),
      expect.any(Object)
    );
    expect(mockDoc.text).toHaveBeenCalledWith(
      expect.stringContaining('12345678'),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object)
    );
    expect(mockDoc.text).toHaveBeenCalledWith(
      expect.stringContaining('120 horas académicas'),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object)
    );
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
  });

  it('should handle QR generation failure gracefully', async () => {
    (QRCode.toBuffer as jest.Mock).mockRejectedValue(new Error('QR Error'));
    
    const data: CertificatePdfData = {};
    const pdfBuffer = await generateCertificatePDF(data);

    expect(mockDoc.end).toHaveBeenCalled();
    expect(pdfBuffer).toBeInstanceOf(Buffer);
  });

  it('should handle axios get failure for signatures', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    const data: CertificatePdfData = {
      teachers: [
        { firstName: 'Jane', lastName: 'Smith', professionalSignatureUrl: 'https://badurl.com/sig.jpg' },
      ]
    };
    
    await generateCertificatePDF(data);

    // It should retry 3 times by default
    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(mockDoc.end).toHaveBeenCalled();
  });
});
