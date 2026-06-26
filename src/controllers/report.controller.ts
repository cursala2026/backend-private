import { Request, Response } from 'express';
import * as repositories from '@/repositories';
import { generateQuestionnaireReportPDF } from '@/services/report-pdf.service';
 
export const downloadQuestionnairePDF = async (req: Request, res: Response) => {
  try {
    const { questionnaireId } = req.params as { questionnaireId: string };
 
    const questionnaire = await (repositories as any).questionnaireRepository.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Cuestionario no encontrado' });
    }
 
    // Traer todas las submissions calificadas (GRADED) del cuestionario
    const submissions = await repositories.questionnaireSubmissionRepository.getGradeReport(questionnaireId);
    const gradedSubmissions = submissions.filter((s: any) => s.status === 'GRADED');
 
    const buffer = await generateQuestionnaireReportPDF(questionnaire, gradedSubmissions);
 
    const safeName = questionnaire.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${safeName}.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generando PDF del cuestionario:', error);
    res.status(500).json({ message: 'Error al generar el PDF' });
  }
};
 