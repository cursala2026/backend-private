/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils';

/**
 * Descarga una imagen desde una URL y retorna un Buffer (usa axios para mayor robustez con CDNs).
 */
async function downloadImage(url: string, retries = 3): Promise<Buffer> {
    let lastError: Error = new Error('Unknown');
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get<ArrayBuffer>(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; CursalaBot/1.0)',
                    'Accept': 'image/png,image/jpeg,image/*;q=0.8',
                },
            });
            const buf = Buffer.from(response.data);
            if (buf.length === 0) throw new Error('Empty image response');
            return buf;
        } catch (err) {
            lastError = err as Error;
            if (attempt < retries) {
                logger.warn(`Logo descarga intento ${attempt} fallido (${url}): ${lastError.message}. Reintentando...`);
                await new Promise((res) => setTimeout(res, 1500 * attempt));
            }
        }
    }
    throw lastError;
}

/**
 * Interfaz para los datos del certificado
 */
export interface CertificatePdfData {
    student?: {
        firstName?: string;
        lastName?: string;
        dni?: string;
    };
    course?: {
        name?: string;
        duration?: number;
    };
    teachers?: {
        firstName?: string;
        lastName?: string;
        professionalSignatureUrl?: string;
        role?: string;
    }[];
    verificationCode?: string;
    partnerLogos?: string[];
}

/**
 * Genera un PDF de certificado con diseño profesional
 */
export async function generateCertificatePDF(certificateData?: CertificatePdfData): Promise<Buffer> {
    logger.info('Generando PDF del certificado');
    logger.info('Teachers data:', certificateData?.teachers);
    
    // Pre-cargar las firmas de los profesores
    const signatures: (Buffer | null)[] = [];
    const teachers = certificateData?.teachers || [];
    
    for (const teacher of teachers) {
        let signatureBuffer: Buffer | null = null;
        const teacherSignatureUrl = teacher.professionalSignatureUrl;
        
        if (teacherSignatureUrl) {
            try {
                if (teacherSignatureUrl.startsWith('http://') || teacherSignatureUrl.startsWith('https://')) {
                    logger.info(`Descargando firma desde URL: ${teacherSignatureUrl}`);
                    signatureBuffer = await downloadImage(teacherSignatureUrl);
                    logger.info('Firma descargada exitosamente');
                } else {
                    // Es una ruta local, leer archivo
                    const staticBaseDir = path.resolve(__dirname, '../../src/static');
                    let signaturePath = path.join(staticBaseDir, 'signatures', teacherSignatureUrl);
                    
                    if (!fs.existsSync(signaturePath)) {
                        signaturePath = path.join(staticBaseDir, 'profile-images', teacherSignatureUrl);
                    }

                    if (fs.existsSync(signaturePath)) {
                        signatureBuffer = fs.readFileSync(signaturePath);
                        logger.info('Firma local cargada desde:', signaturePath);
                    }
                }
            } catch (error) {
                logger.warn('Error al cargar firma del profesor:', error);
            }
        }
        signatures.push(signatureBuffer);
    }

    // Pre-cargar logos de socios/instituciones en PARALELO
    const partnerLogoUrls = (certificateData?.partnerLogos || []).slice(0, 6);
    const partnerLogoBuffers: (Buffer | null)[] = await Promise.all(
        partnerLogoUrls.map(async (logoUrl): Promise<Buffer | null> => {
            if (!logoUrl) return null;
            try {
                const raw = await downloadImage(logoUrl);
                // Normalizar a JPEG con sharp para garantizar compatibilidad con PDFKit
                // (evita problemas con PNGs interlazados, perfiles ICC, canales alpha, etc.)
                const jpeg = await sharp(raw)
                    .flatten({ background: { r: 255, g: 255, b: 255 } }) // alpha sobre blanco
                    .jpeg({ quality: 95 })
                    .toBuffer();
                logger.info(`Logo normalizado OK (${jpeg.length} bytes): ${logoUrl}`);
                return jpeg;
            } catch (err) {
                logger.warn(`Error al cargar/normalizar logo de socio (${logoUrl}):`, (err as Error).message);
                return null;
            }
        })
    );
    logger.info(`Logos válidos para PDF: ${partnerLogoBuffers.filter(Boolean).length} / ${partnerLogoUrls.length}`);
    
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
            });
            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // Dimensiones A4 landscape: 841.89 x 595.28 puntos
            const pageWidth = 841.89;
            const pageHeight = 595.28;

            // Colores del diseño
            const colors = {
                textDark: '#24313d',
                textMid: '#4a5560',
                accent: '#0090d8',
                background: '#ffffff',
                border: '#d1d9de',
            };

            // Fondo blanco
            doc.rect(0, 0, pageWidth, pageHeight).fill(colors.background);

            // Cargar imágenes de header y footer
            try {
                // Intentar múltiples rutas posibles para las imágenes
                const possiblePaths = [
                    path.resolve(__dirname, '../static/certificates/header.png'),
                    path.resolve(__dirname, '../../static/certificates/header.png'),
                    path.resolve('/app/src/static/certificates/header.png'),
                    path.resolve('/app/dist/src/static/certificates/header.png'),
                ];
                
                let headerImagePath: string | null = null;
                let footerImagePath: string | null = null;
                
                for (const testPath of possiblePaths) {
                    const testHeader = testPath;
                    const testFooter = testPath.replace('header.png', 'footer.png');
                    if (fs.existsSync(testHeader) && fs.existsSync(testFooter)) {
                        headerImagePath = testHeader;
                        footerImagePath = testFooter;
                        break;
                    }
                }

                if (headerImagePath && fs.existsSync(headerImagePath)) {
                    doc.image(headerImagePath, 5.67, 5.67, { width: pageWidth - 11.34 });
                    logger.info(`Header image loaded from: ${headerImagePath}`);
                } else {
                    logger.warn(`Header image not found. Tried paths: ${possiblePaths.join(', ')}`);
                }

                if (footerImagePath && fs.existsSync(footerImagePath)) {
                    const footerMargin = 5.67;
                    const footerHeight = 160;
                    const bottomOfImage = pageHeight - footerMargin;
                    const footerY = bottomOfImage - footerHeight;
                    doc.image(footerImagePath, footerMargin, footerY, {
                        width: pageWidth - footerMargin * 2,
                        height: footerHeight,
                    });
                    logger.info(`Footer image loaded from: ${footerImagePath}`);
                } else {
                    logger.warn(`Footer image not found. Tried paths: ${possiblePaths.map(p => p.replace('header.png', 'footer.png')).join(', ')}`);
                }
            } catch (error) {
                logger.error('Error cargando imágenes header/footer', error);
            }

            // Datos del certificado
            const studentName = certificateData?.student
                ? `${certificateData.student.firstName} ${certificateData.student.lastName}`.toUpperCase()
                : 'PARTICIPANTE CERTIFICADO';
            const courseName = certificateData?.course?.name || 'Curso de Capacitación';
            const dni = certificateData?.student?.dni;
            const issueDate = new Date().toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            const teacherName = certificateData?.teachers?.[0]
                ? `${certificateData.teachers[0].firstName} ${certificateData.teachers[0].lastName}`
                : null;

            // Área de contenido principal
            const contentWidth = pageWidth * 0.65;
            const contentX = (pageWidth - contentWidth) / 2;
            const contentY = 180;

            // "Se certifica que:"
            doc.fontSize(16).font('Helvetica').fillColor(colors.textMid).text('Se certifica que:', contentX, contentY, {
                width: contentWidth,
                align: 'center',
            });

            // Nombre del estudiante
            doc
                .fontSize(28)
                .font('Helvetica-Bold')
                .fillColor(colors.textDark)
                .text(studentName, contentX, contentY + 30, {
                    width: contentWidth,
                    align: 'center',
                    characterSpacing: 0.5,
                });

            // DNI section
            if (dni) {
                const dniCompleteText = `D.N.I.     ${dni}`;
                const dniY = contentY + 70;
                const dniLabelWidth = doc.font('Helvetica').fontSize(24).widthOfString('D.N.I.     ');
                const totalTextWidth = doc.font('Helvetica-Bold').fontSize(24).widthOfString(dniCompleteText);
                const startX = contentX + (contentWidth - totalTextWidth) / 2;

                doc.fontSize(24).font('Helvetica').fillColor(colors.textMid).text('D.N.I.     ', startX, dniY);
                doc
                    .fontSize(24)
                    .font('Helvetica-Bold')
                    .fillColor(colors.textDark)
                    .text(dni, startX + dniLabelWidth, dniY, { characterSpacing: 0.5 });
            }

            // "APROBÓ EL CURSO"
            doc
                .fontSize(16)
                .font('Helvetica')
                .fillColor(colors.textMid)
                .text('APROBÓ EL CURSO', contentX, contentY + (dni ? 115 : 95), {
                    width: contentWidth,
                    align: 'center',
                });

            // Nombre del curso
            doc
                .fontSize(28)
                .font('Helvetica-Bold')
                .fillColor(colors.textDark)
                .text(`"${courseName}"`, contentX, contentY + (dni ? 135 : 115), {
                    width: contentWidth,
                    align: 'center',
                    lineGap: 2,
                    characterSpacing: 0.5,
                });

            // Horas del curso
            const courseDuration = certificateData?.course?.duration;
            const hasHours = courseDuration && courseDuration > 0;
            if (hasHours) {
                doc
                    .fontSize(12)
                    .font('Helvetica')
                    .fillColor(colors.textMid)
                    .text(`Duración: ${courseDuration} horas académicas`, contentX, contentY + (dni ? 210 : 190), {
                        width: contentWidth,
                        align: 'center',
                    });
            }

            // Fecha de emisión
            let dateYPosition: number;
            if (dni) {
                dateYPosition = hasHours ? 230 : 210;
            } else {
                dateYPosition = hasHours ? 210 : 190;
            }

            doc
                .fontSize(12)
                .font('Helvetica')
                .fillColor(colors.textMid)
                .text(`Emitido el ${issueDate}`, contentX, contentY + dateYPosition, {
                    width: contentWidth,
                    align: 'center',
                });

            // QR Code area
            const qrSize = 100;
            const qrX = pageWidth - 145;
            const qrY = (pageHeight - qrSize) / 2 - 40;

            doc.rect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16).stroke(colors.border).lineWidth(1);

            // Firmas de los profesores (de derecha a izquierda)
            if (teachers && teachers.length > 0) {
                logger.info(`PROCESANDO ${teachers.length} PROFESORES PARA EL PDF`);
                const spacingX = 155; // Espacio entre firmas (de derecha a izquierda)
                // La página es 595.28pt, footer empieza en ~430. El espacio blanco disponible
                // para firmas es aproximadamente Y=410-520. Centramos la línea de firma en ~465.
                const signaturesBaseY = 457;
                
                teachers.forEach((teacher, index) => {
                    const teacherName = `${teacher.firstName} ${teacher.lastName}`;
                    const sigY = signaturesBaseY;
                    const sigX = (pageWidth - 150) - (index * spacingX);
                    const signatureBuffer = signatures[index];

                    logger.info(`Profesor ${index + 1}: ${teacherName} en X:${sigX.toFixed(0)}, Y:${sigY}`);

                    // Forzar dibujo de línea y texto ANTES de la imagen para asegurar que aparezcan
                    doc.save();
                    
                    // Línea de firma
                    doc.moveTo(sigX - 55, sigY - 2)
                       .lineTo(sigX + 55, sigY - 2)
                       .lineWidth(1)
                       .stroke('#000000'); 

                    // Nombre del profesor
                    doc.fillColor('#000000')
                       .font('Helvetica-Bold')
                       .fontSize(7.5)
                       .text(teacherName.toUpperCase(), sigX - 65, sigY + 6, { 
                           align: 'center', 
                           width: 130 
                       });

                    doc.fillColor('#4a5560')
                       .font('Helvetica')
                       .fontSize(6)
                       .text(teacher.role === 'director' ? 'DIRECTOR DE CURSALA' : 'INSTRUCTOR DE CURSALA', sigX - 60, sigY + 17, {
                           align: 'center',
                           width: 120,
                       });

                    // Imagen de la firma encima de la línea
                    if (signatureBuffer && signatureBuffer.length > 0) {
                        try {
                            const signatureWidth = 80;
                            const signatureHeight = 38;
                            doc.image(signatureBuffer, sigX - signatureWidth / 2, sigY - signatureHeight - 4, {
                                width: signatureWidth,
                                height: signatureHeight,
                            });
                            logger.info(`Imagen de firma ${index + 1} insertada en el PDF`);
                        } catch (error: any) {
                            logger.warn(`Error al insertar imagen de firma ${index + 1}:`, error.message);
                        }
                    } else {
                        logger.warn(`No hay buffer de firma para Profesor ${index + 1}`);
                    }
                    
                    doc.restore();
                });
            } else {
                logger.warn('No se encontraron profesores en certificateData');

                const sigY = qrY + qrSize + 30;
                const sigX = qrX + qrSize / 2;

                doc
                    .fontSize(14)
                    .font('Helvetica-Bold')
                    .fillColor(colors.textDark)
                    .text('Cursala', sigX - 25, sigY, { align: 'center', width: 50 });

                doc
                    .fontSize(10)
                    .font('Helvetica-Bold')
                    .fillColor(colors.textMid)
                    .text('PLATAFORMA EDUCATIVA', sigX - 40, sigY + 18, { align: 'center', width: 80 });
            }

            // Generar QR Code
            const qrContent = `${process.env.FRONTEND_URL || 'https://cursala.com.ar'}/certificate/${certificateData?.verificationCode || 'test'}`;

            // Dibujar logos institucionales entre las firmas y el footer
            // Área segura: X de 175 (evita gráfico Cursala izquierdo) a qrX-25 (evita borde QR y margen derecho)
            const validLogoBuffers = partnerLogoBuffers.filter((b): b is Buffer => b !== null && b.length > 0);
            if (validLogoBuffers.length > 0) {
                const logoAreaY = 492;
                const logoHeight = 30;
                const logoPad = 10; // espacio entre logos
                const logoLeftBound = 175;
                const logoRightBound = pageWidth - 30; // Los logos (Y≈492) no solapan verticalmente con el QR (Y≈207)
                const safeWidth = logoRightBound - logoLeftBound; // ≈ 496pt

                // Calcular tamaño máximo por logo para que quepan todos dentro del área segura
                const maxLogoWidth = Math.min(70, Math.floor((safeWidth - (validLogoBuffers.length - 1) * logoPad) / validLogoBuffers.length));
                const totalWidth = validLogoBuffers.length * maxLogoWidth + (validLogoBuffers.length - 1) * logoPad;
                // Centrar dentro del área segura
                let logoX = logoLeftBound + Math.max(0, (safeWidth - totalWidth) / 2);

                for (const logoBuf of validLogoBuffers) {
                    try {
                        doc.image(logoBuf, logoX, logoAreaY, { fit: [maxLogoWidth, logoHeight] });
                    } catch (err: any) {
                        logger.warn('Error al insertar logo institucional en el PDF:', err.message);
                    }
                    logoX += maxLogoWidth + logoPad;
                }
                logger.info(`${validLogoBuffers.length} logos institucionales insertados en el certificado`);
            }

            QRCode.toBuffer(qrContent, {
                margin: 1,
                width: qrSize * 4,
                color: { dark: colors.textDark, light: colors.background },
            })
                .then((qrPng: Buffer) => {
                    doc.image(qrPng, qrX, qrY, { width: qrSize });
                    doc.end();
                })
                .catch((qrError) => {
                    logger.warn('No se pudo generar QR code, continuando sin él', qrError);
                    doc.end();
                });
        } catch (err) {
            logger.error('Error generating PDF', err);
            reject(err);
        }
    });
}
