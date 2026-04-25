import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { ReportCatalogItem } from './reports.types';

@Injectable()
export class ReportsPdfService {
  async buildPdfBuffer(
    report: ReportCatalogItem,
    rows: Array<Record<string, unknown>>,
    locale: string,
  ): Promise<Buffer> {
    const isArabic = locale === 'ar';
    const columns = report.preview_columns;
    const html = `
      <html dir="${isArabic ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; }
          h1 { margin: 0 0 12px; font-size: 18px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: ${isArabic ? 'right' : 'left'}; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>${report.title_code}</h1>
        <table>
          <thead>
            <tr>${columns.map((c) => `<th>${c.label_code}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) =>
                  `<tr>${columns
                    .map((c) => `<td>${r[c.key] ?? ''}</td>`)
                    .join('')}</tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
