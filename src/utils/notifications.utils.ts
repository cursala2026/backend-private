import { loadTemplate, renderTemplate, getTemplatePath } from '../utils/templatesLoader';

export function buildNoEnrollmentEmail(user: { name: string }, courses: any[], config: any) {
    const rawHtml = loadTemplate(getTemplatePath('no-enrollment'));
        
    return renderTemplate(rawHtml, { 
        user: user.name, 
        ctaUrl: config.ctaUrl, 
        interestLink: config.interestLink, 
        unsubscribeLink: config.unsubscribeLink, 
        courses: `
            <table align="center" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    ${courses.slice(0, 3).map((c, i) => `
                    <td valign="top" style="padding:10px;width:33%;">
                        <img src="${c.img}" alt="${c.name}" style="width:100%;max-width:250px;display:block;margin:auto;margin-bottom:10px;" />
                        <div style="padding:10px;border:1px solid #ddd;border-radius:8px;box-shadow:0 2px 6px rgb(200, 199, 199);">
                            <p style="background:${i===0 ? '#3B82F6' : i===1 ? '#4338CA' : '#FACC15'};color:#fff;font-size:12px;font-weight:bold;padding:4px 8px;border-radius:4px;display:inline-block;margin:0 0 10px;">
                                Curso ${i+1}
                            </p>
                            <h4  style="color:#333;font-size:16px;margin:0 0 10px;">${c.name}</h4>
                            <p  style="color:#555;font-size:14px;margin:0 0 10px;">${c.description}</p>
                            <p  style="color:#555;font-size:13px;margin:0;">⏱ ${c.duration} horas   🔹 ${c.level}</p>
                        </div>
                    </td>
                `).join('')}
                </tr>
            </table>
        `
    });
}
    
export function buildCourseStartEmail(user: { name: string, course: string }, template: 'welcome' | 'reminder') {
    const rawHtml = loadTemplate(getTemplatePath(template));
    return renderTemplate(rawHtml, { 
        user: user.name,
        course: user.course
    });
}
