import { RECRUITMENT_STATUS } from './recruitment.constants';
import {
  validateNormalizedImportRow,
  type NormalizedImportRow,
} from './recruitment-import.row-validator';
import { HR_RECRUITMENT_IMPORT_ERROR } from './recruitment-import.validation';

function baseRow(
  overrides: Partial<NormalizedImportRow> = {},
): NormalizedImportRow {
  return {
    row_index: 0,
    status_code: RECRUITMENT_STATUS.UNDER_PROCEDURE,
    full_name_ar: 'أحمد',
    full_name_en: 'Ahmed',
    nationality: 'SA',
    passport_no: 'AB1234567',
    passport_expiry_at: new Date('2030-01-15T12:00:00.000Z').toISOString(),
    responsible_office: 'Office',
    responsible_office_number: null,
    visa_deadline_at: null,
    visa_sent_at: null,
    expected_arrival_at: null,
    notes: null,
    passport_image_file_id: '00000000-0000-4000-8000-000000000099',
    visa_image_file_id: null,
    flight_ticket_image_file_id: null,
    personal_picture_file_id: null,
    ...overrides,
  };
}

describe('validateNormalizedImportRow', () => {
  it('passes a valid UNDER_PROCEDURE row', () => {
    const errs = validateNormalizedImportRow(baseRow());
    expect(errs).toEqual([]);
  });

  it('requires passport image', () => {
    const errs = validateNormalizedImportRow(
      baseRow({ passport_image_file_id: '' }),
    );
    expect(
      errs.some((e) => e.code === HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD),
    ).toBe(true);
  });

  it('fails UNDER_PROCEDURE when English name is too short', () => {
    const errs = validateNormalizedImportRow(baseRow({ full_name_en: 'A' }));
    expect(
      errs.some((e) => e.code === HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD),
    ).toBe(true);
  });
});
