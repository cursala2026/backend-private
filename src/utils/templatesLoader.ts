import fs from 'fs';
import path from 'path';

export function loadTemplate(templatePath: string): string {
    return fs.readFileSync(templatePath, 'utf-8');
}

export function renderTemplate(html: string, data: Record<string, string>): string {
    return Object.keys(data).reduce(
        (acc, key) => acc.replace(new RegExp(`{{${key}}}`, 'g'), data[key]),
        html
    );
}

export function getTemplatePath(type: 'no-enrollment' | 'welcome' | 'reminder'): string {
    if (type === 'no-enrollment') {
        return path.join(__dirname, '../templates/no-enrollment.html');
    }
    return path.join(__dirname, `../templates/course-start/${type}.html`);
}