/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils';

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
    teacher?: {
        firstName?: string;
        lastName?: string;
        professionalSignatureUrl?: string;
    };
    verificationCode?: string;
}

/**
 * Genera un PDF de certificado con diseño profesional
 */
export async function generateCertificatePDF(certificateData?: CertificatePdfData): Promise<Buffer> {
    logger.info('Generando PDF del certificado');
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
            const teacherName = certificateData?.teacher
                ? `${certificateData.teacher.firstName} ${certificateData.teacher.lastName}`
                : null;

            // Área de contenido principal
            const contentWidth = pageWidth * 0.65;
            const contentX = (pageWidth - contentWidth) / 2;
            const contentY = 180;

            // "Se certifica que:"
            doc.fontSize(18).font('Helvetica').fillColor(colors.textMid).text('Se certifica que:', contentX, contentY, {
                width: contentWidth,
                align: 'center',
            });

            // Nombre del estudiante
            doc
                .fontSize(32)
                .font('Helvetica-Bold')
                .fillColor(colors.textDark)
                .text(studentName, contentX, contentY + 35, {
                    width: contentWidth,
                    align: 'center',
                    characterSpacing: 1,
                });

            // DNI section
            if (dni) {
                const dniCompleteText = `D.N.I.     ${dni}`;
                const dniY = contentY + 85;
                const dniLabelWidth = doc.font('Helvetica').fontSize(32).widthOfString('D.N.I.     ');
                const totalTextWidth = doc.font('Helvetica-Bold').fontSize(32).widthOfString(dniCompleteText);
                const startX = contentX + (contentWidth - totalTextWidth) / 2;

                doc.fontSize(32).font('Helvetica').fillColor(colors.textMid).text('D.N.I.     ', startX, dniY);
                doc
                    .fontSize(32)
                    .font('Helvetica-Bold')
                    .fillColor(colors.textDark)
                    .text(dni, startX + dniLabelWidth, dniY, { characterSpacing: 1 });
            }

            // "APROBÓ EL CURSO"
            doc
                .fontSize(18)
                .font('Helvetica')
                .fillColor(colors.textMid)
                .text('APROBÓ EL CURSO', contentX, contentY + (dni ? 135 : 105), {
                    width: contentWidth,
                    align: 'center',
                });

            // Nombre del curso
            doc
                .fontSize(32)
                .font('Helvetica-Bold')
                .fillColor(colors.textDark)
                .text(`"${courseName}"`, contentX, contentY + (dni ? 155 : 135), {
                    width: contentWidth,
                    align: 'center',
                    lineGap: 3,
                    characterSpacing: 1,
                });

            // Horas del curso
            const courseDuration = certificateData?.course?.duration;
            if (courseDuration && courseDuration > 0) {
                doc
                    .fontSize(14)
                    .font('Helvetica')
                    .fillColor(colors.textMid)
                    .text(`Duración: ${courseDuration} horas académicas`, contentX, contentY + (dni ? 195 : 175), {
                        width: contentWidth,
                        align: 'center',
                    });
            }

            // Fecha de emisión
            const hasHours = courseDuration && courseDuration > 0;
            let dateYPosition: number;
            if (dni) {
                dateYPosition = hasHours ? 215 : 200;
            } else {
                dateYPosition = hasHours ? 195 : 180;
            }

            doc
                .fontSize(14)
                .font('Helvetica')
                .fillColor(colors.textMid)
                .text(`Emitido el ${issueDate}`, contentX, contentY + dateYPosition, {
                    width: contentWidth,
                    align: 'center',
                });

            // QR Code area
            const qrSize = 140;
            const qrX = pageWidth - 155;
            const qrY = (pageHeight - qrSize) / 2;

            doc.rect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16).stroke(colors.border).lineWidth(1);

            // Firma del profesor
            if (teacherName) {
                const sigY = qrY + qrSize + 25;
                const sigX = qrX + qrSize / 2;
                const teacherSignatureUrl = certificateData?.teacher?.professionalSignatureUrl;
                let signatureImageHeight = 0;

                if (teacherSignatureUrl) {
                    try {
                        let signaturePath = path.join('/app/dist/src/static/signatures', teacherSignatureUrl);
                        if (!fs.existsSync(signaturePath)) {
                            signaturePath = path.join('/app/dist/src/static/profile-images', teacherSignatureUrl);
                        }

                        if (fs.existsSync(signaturePath)) {
                            const signatureWidth = 100;
                            const signatureHeight = 50;
                            doc.image(signaturePath, sigX - signatureWidth / 2, sigY, {
                                width: signatureWidth,
                                height: signatureHeight,
                                align: 'center',
                                fit: [signatureWidth, signatureHeight],
                            });
                            signatureImageHeight = signatureHeight + 2;
                        }
                    } catch (error) {
                        logger.warn('No se pudo cargar la firma profesional', error);
                    }
                }

                doc
                    .fontSize(11)
                    .font('Helvetica-Bold')
                    .fillColor(colors.textDark)
                    .text(teacherName, sigX - 75, sigY + signatureImageHeight, { align: 'center', width: 150 });

                doc
                    .fontSize(9)
                    .font('Helvetica')
                    .fillColor(colors.textMid)
                    .text('INSTRUCTOR DE CURSALA', sigX - 75, sigY + signatureImageHeight + 14, {
                        align: 'center',
                        width: 150,
                    });
            } else {
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
