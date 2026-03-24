import type { RecruitmentExportColumnKey } from './recruitment-import.constants';
import { RECRUITMENT_EXPORT_COLUMN_KEYS } from './recruitment-import.constants';

const HEADER_EN: Record<RecruitmentExportColumnKey, string> = {
  full_name_ar: 'Full Name (Arabic)',
  full_name_en: 'Full Name (English)',
  nationality: 'Nationality',
  passport_no: 'Passport No.',
  passport_expiry_at: 'Passport Expiry Date',
  status_code: 'Status',
  responsible_office: 'Responsible Office',
  responsible_office_number: 'Responsible Office Number',
  visa_deadline_at: 'Visa Deadline',
  visa_sent_at: 'Visa Sent Date',
  expected_arrival_at: 'Expected Arrival',
  notes: 'Notes',
};

const HEADER_AR: Record<RecruitmentExportColumnKey, string> = {
  full_name_ar: 'الاسم الكامل (بالعربي)',
  full_name_en: 'الاسم الكامل (بالإنجليزي)',
  nationality: 'الجنسية',
  passport_no: 'رقم جواز السفر',
  passport_expiry_at: 'تاريخ انتهاء جواز السفر',
  status_code: 'الحالة',
  responsible_office: 'المكتب المسؤول',
  responsible_office_number: 'رقم المكتب المسؤول',
  visa_deadline_at: 'موعد انتهاء التأشيرة',
  visa_sent_at: 'تاريخ إرسال التأشيرة',
  expected_arrival_at: 'موعد الوصول',
  notes: 'ملاحظات',
};

/** Arabic labels for recruitment status values (export only). */
const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  UNDER_PROCEDURE: 'تحت الإجراء',
  ON_ARRIVAL: 'في الطريق',
  ARRIVED: 'وصل',
};

export function getExportColumnHeaders(locale: 'en' | 'ar'): string[] {
  const map = locale === 'ar' ? HEADER_AR : HEADER_EN;
  return RECRUITMENT_EXPORT_COLUMN_KEYS.map((k) => map[k]);
}

export function formatExportStatusValue(
  statusCode: string,
  locale: 'en' | 'ar',
): string {
  if (locale !== 'ar') return statusCode;
  return STATUS_AR[statusCode] ?? statusCode;
}
