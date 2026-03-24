import Excel from 'exceljs';
import {
  RECRUITMENT_IMPORT_COLUMN_KEYS,
  type RecruitmentExportColumnKey,
  type RecruitmentImportColumnKey,
} from './recruitment-import.constants';
import { sanitizeExcelCellValue } from './recruitment-import.sanitize';

export function cellToString(val: unknown): string {
  if (val == null) return '';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'object' && val !== null && 'text' in val) {
    return String((val as { text?: string }).text ?? '').trim();
  }
  return String(val).trim();
}

export function buildTemplateWorkbook(
  locale: 'en' | 'ar',
  instructions: Record<RecruitmentImportColumnKey, string>,
): Excel.Workbook {
  const wb = new Excel.Workbook();
  const ws = wb.addWorksheet('Candidates', {
    views: [{ rightToLeft: locale === 'ar' }],
  });

  const headerRow = ws.addRow([...RECRUITMENT_IMPORT_COLUMN_KEYS]);
  headerRow.font = { bold: true };
  const instructionRow = ws.addRow(
    RECRUITMENT_IMPORT_COLUMN_KEYS.map((k) => instructions[k] ?? ''),
  );
  instructionRow.font = { italic: true, color: { argb: 'FF666666' } };

  const sample1 = [
    'أحمد محمد',
    'Ahmed Mohammed',
    'SA',
    'AB1234567',
    '2030-12-31',
    'UNDER_PROCEDURE',
    'Office A',
    '0501234567',
    '2031-06-01',
    '2030-11-01',
    '2031-01-15',
    'Example note',
    'https://picsum.photos/seed/p1/400/300',
    'https://picsum.photos/seed/v1/400/300',
    'https://picsum.photos/seed/f1/400/300',
    'https://picsum.photos/seed/pp1/400/300',
  ];
  ws.addRow(sample1);
  const sample2 = [
    'سارة علي',
    'Sara Ali',
    'EG',
    'CD9876543',
    '2029-06-15',
    'DRAFT',
    'Office B',
    '',
    '',
    '',
    '',
    'Draft note',
    'https://picsum.photos/seed/p2/400/300',
    '',
    '',
    '',
  ];
  ws.addRow(sample2);

  ws.columns.forEach((col) => {
    col.width = 18;
  });

  return wb;
}

export async function parseImportWorksheet(
  buffer: Buffer,
): Promise<{
  headerMap: Map<RecruitmentImportColumnKey, number>;
  dataRows: Array<{ sheetRowNumber: number; values: Record<string, string> }>;
}> {
  const wb = new Excel.Workbook();
  // exceljs typings expect a narrow Buffer; runtime accepts standard Buffer
  await wb.xlsx.load(buffer as never);
  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error('WORKBOOK_EMPTY');
  }

  const headerRow = ws.getRow(1);
  const headerMap = new Map<RecruitmentImportColumnKey, number>();
  headerRow.eachCell((cell, colNumber) => {
    const key = cellToString(cell.value) as RecruitmentImportColumnKey;
    if (
      RECRUITMENT_IMPORT_COLUMN_KEYS.includes(key as RecruitmentImportColumnKey)
    ) {
      headerMap.set(key as RecruitmentImportColumnKey, colNumber);
    }
  });

  for (const key of RECRUITMENT_IMPORT_COLUMN_KEYS) {
    if (!headerMap.has(key)) {
      throw new Error('HEADER_ROW_INVALID');
    }
  }

  const dataRows: Array<{
    sheetRowNumber: number;
    values: Record<string, string>;
  }> = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    const values: Record<string, string> = {};
    let any = false;
    for (const key of RECRUITMENT_IMPORT_COLUMN_KEYS) {
      const col = headerMap.get(key)!;
      const cell = row.getCell(col);
      const s = cellToString(cell.value);
      values[key] = s;
      if (s !== '') any = true;
    }
    if (any) {
      dataRows.push({ sheetRowNumber: rowNumber, values });
    }
  });

  return { headerMap, dataRows };
}

export async function buildExportWorkbook(
  rows: Array<Record<string, unknown>>,
  columnKeys: RecruitmentExportColumnKey[],
  headerLabels: string[],
  options?: { rtl?: boolean },
): Promise<Excel.Workbook> {
  const wb = new Excel.Workbook();
  const ws = wb.addWorksheet('Export', {
    views: [{ rightToLeft: options?.rtl ?? false }],
  });
  if (headerLabels.length !== columnKeys.length) {
    throw new Error('EXPORT_HEADER_KEY_MISMATCH');
  }
  const headerRow = ws.addRow(headerLabels);
  headerRow.font = { bold: true };
  for (const r of rows) {
    const line = columnKeys.map((k) =>
      sanitizeExcelCellValue(
        r[k] != null && r[k] !== undefined ? String(r[k]) : '',
      ),
    );
    ws.addRow(line);
  }
  ws.columns.forEach((col) => {
    col.width = 22;
  });
  return wb;
}
