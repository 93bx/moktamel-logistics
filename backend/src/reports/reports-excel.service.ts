import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ReportCatalogItem } from './reports.types';

@Injectable()
export class ReportsExcelService {
  async buildWorkbookBuffer(
    report: ReportCatalogItem,
    rows: Array<Record<string, unknown>>,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(report.key);
    const columns = [...report.preview_columns, ...report.export_columns];
    sheet.columns = columns.map((c) => ({
      header: c.label_code,
      key: c.key,
      width: 24,
    }));
    for (const row of rows) {
      sheet.addRow(row as any);
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
