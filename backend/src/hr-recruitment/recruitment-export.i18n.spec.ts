import {
  formatExportStatusValue,
  getExportColumnHeaders,
} from './recruitment-export.i18n';

describe('recruitment-export.i18n', () => {
  it('getExportColumnHeaders uses Status for EN status column', () => {
    const headers = getExportColumnHeaders('en');
    expect(headers).toContain('Status');
    expect(headers.some((h) => h.includes('_'))).toBe(false);
  });

  it('formatExportStatusValue leaves codes in English mode', () => {
    expect(formatExportStatusValue('DRAFT', 'en')).toBe('DRAFT');
  });

  it('formatExportStatusValue translates known statuses in Arabic mode', () => {
    expect(formatExportStatusValue('DRAFT', 'ar')).toBe('مسودة');
    expect(formatExportStatusValue('UNDER_PROCEDURE', 'ar')).toBe('تحت الإجراء');
  });
});
