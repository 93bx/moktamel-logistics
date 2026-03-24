import { sanitizeExcelCellValue } from './recruitment-import.sanitize';

describe('sanitizeExcelCellValue', () => {
  it('prefixes formula-risk leading characters', () => {
    expect(sanitizeExcelCellValue('=1+1')).toBe("'=1+1");
    expect(sanitizeExcelCellValue('+123')).toBe("'+123");
    expect(sanitizeExcelCellValue('-5')).toBe("'-5");
    expect(sanitizeExcelCellValue('@ref')).toBe("'@ref");
  });

  it('leaves safe strings unchanged', () => {
    expect(sanitizeExcelCellValue('normal')).toBe('normal');
    expect(sanitizeExcelCellValue('')).toBe('');
  });
});
