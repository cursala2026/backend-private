import PDFDocument from 'pdfkit';

export async function generateQuestionnaireReportPDF(
  questionnaire: any,
  submissions: any[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
 
    // ── Encabezado ──────────────────────────────────────────────────────────────
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(`Reporte de Resultados: ${questionnaire.title}`, { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generado: ${new Date().toLocaleDateString('es-AR')}`, { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Total de entregas: ${submissions.length}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();
 
    if (submissions.length === 0) {
      doc.fontSize(12).font('Helvetica').text('No hay entregas calificadas para este cuestionario.');
      doc.end();
      return;
    }
 
    // ── Una sección por estudiante ───────────────────────────────────────────────
    submissions.forEach((submission: any, index: number) => {
      if (index > 0) {
        doc.addPage();
      }
 
      // Cabecera del estudiante
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`Estudiante: ${submission.studentName || 'N/A'}`);
      doc
        .fontSize(11)
        .font('Helvetica')
        .text(`Email: ${submission.studentEmail || 'N/A'}`);
 
      const score = submission.finalScore ?? submission.autoGradedScore ?? 0;
      const passingScore = questionnaire.passingScore || 0;
      doc.text(`Nota: ${score.toFixed(1)}%  ${score >= passingScore ? '✓ Aprobado' : '✗ Desaprobado'}`);
      doc.text(`Intento #${submission.attemptNumber || 1}`);
 
      if (submission.submittedAt) {
        doc.text(`Fecha de entrega: ${new Date(submission.submittedAt).toLocaleDateString('es-AR')}`);
      }
 
      if (submission.startedAt && submission.submittedAt) {
        const diffMs = new Date(submission.submittedAt).getTime() - new Date(submission.startedAt).getTime();
        const totalSeconds = Math.floor(diffMs / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const timeStr = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
        doc.text(`Tiempo de resolución: ${timeStr}`);
      }
 
      if (submission.feedback) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Comentario general:');
        doc.font('Helvetica').text(submission.feedback);
      }
 
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).dash(3, { space: 3 }).stroke();
      doc.undash();
      doc.moveDown();
 
      // Respuestas por pregunta
      questionnaire.questions.forEach((q: any, i: number) => {
        const answer = submission.answers?.find(
          (a: any) => a.questionId?.toString() === q._id?.toString()
        );
 
        doc.fontSize(11).font('Helvetica-Bold').text(`${i + 1}. ${q.questionText}`);
 
        if (!answer) {
          doc.fontSize(10).font('Helvetica').fillColor('gray').text('Sin respuesta').fillColor('black');
        } else if (q.type === 'TEXT') {
          doc.fontSize(10).font('Helvetica').text(`Respuesta: ${answer.textAnswer || '(vacía)'}`);
          if (!questionnaire.isSurvey) {
            doc.text(`Puntos: ${answer.pointsAwarded ?? 0} / ${q.points}`);
            if (answer.feedback) doc.text(`Retroalimentación: ${answer.feedback}`);
          }
        } else if (q.type === 'MULTIPLE_CHOICE' || q.type === 'MULTIPLE_SELECT') {
          // Resolver texto de la opción seleccionada
          const opts = q.options || [];
          if (q.type === 'MULTIPLE_CHOICE') {
            const selected = opts.find(
              (o: any) => o._id?.toString() === answer.selectedOptionId?.toString()
            );
            doc.fontSize(10).font('Helvetica').text(`Respuesta: ${selected?.text || answer.selectedOptionId || 'No respondida'}`);
          } else {
            const selectedTexts = (answer.selectedOptionIds || []).map((id: string) => {
              const o = opts.find((opt: any) => opt._id?.toString() === id?.toString());
              return o?.text || id;
            });
            doc.fontSize(10).font('Helvetica').text(`Respuesta: ${selectedTexts.join(', ') || 'No respondida'}`);
          }
          if (!questionnaire.isSurvey) {
            doc.text(`Resultado: ${answer.isCorrect ? '✓ Correcta' : '✗ Incorrecta'}`);
          }
        }
 
        doc.moveDown(0.5);
      });
    });
 
    doc.end();
  });
}