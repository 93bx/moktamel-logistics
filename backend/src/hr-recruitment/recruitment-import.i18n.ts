import type { RecruitmentImportColumnKey } from './recruitment-import.constants';

const EN: Record<RecruitmentImportColumnKey, string> = {
  full_name_ar: 'Arabic full name (required for published row)',
  full_name_en: 'English full name (required for published row)',
  nationality: 'Nationality code (e.g. SA)',
  passport_no: 'Passport number (unique per company)',
  passport_expiry_at: 'Date YYYY-MM-DD (required for UNDER_PROCEDURE)',
  status: 'DRAFT or UNDER_PROCEDURE (empty = UNDER_PROCEDURE)',
  responsible_office: 'Responsible office',
  responsible_office_number: 'Max 10 digits',
  visa_deadline_at: 'Optional date YYYY-MM-DD',
  visa_sent_at: 'Optional date YYYY-MM-DD',
  expected_arrival_at: 'Optional date YYYY-MM-DD',
  notes: 'Max 5000 characters',
  passport_image_url:
    'Required: HTTPS URL to an image (JPEG/PNG/GIF/WebP); fetched and stored',
  visa_image_url:
    'Optional: HTTPS image URL; must be a valid image if provided',
  flight_ticket_image_url:
    'Optional: HTTPS image URL; must be a valid image if provided',
  personal_picture_url:
    'Optional: HTTPS image URL; must be a valid image if provided',
};

const AR: Record<RecruitmentImportColumnKey, string> = {
  full_name_ar: 'الاسم الكامل بالعربية (مطلوب للصف المنشور)',
  full_name_en: 'الاسم الكامل بالإنجليزية (مطلوب للصف المنشور)',
  nationality: 'رمز الجنسية (مثال SA)',
  passport_no: 'رقم الجواز (فريد داخل الشركة)',
  passport_expiry_at: 'تاريخ بصيغة YYYY-MM-DD (مطلوب لـ UNDER_PROCEDURE)',
  status: 'DRAFT أو UNDER_PROCEDURE (فارغ = UNDER_PROCEDURE)',
  responsible_office: 'المكتب المسؤول',
  responsible_office_number: 'حتى 10 أرقام',
  visa_deadline_at: 'تاريخ اختياري YYYY-MM-DD',
  visa_sent_at: 'تاريخ اختياري YYYY-MM-DD',
  expected_arrival_at: 'تاريخ اختياري YYYY-MM-DD',
  notes: 'ملاحظات حتى 5000 حرف',
  passport_image_url:
    'مطلوب: رابط HTTPS لصورة (JPEG/PNG/GIF/WebP)؛ يُجلب الملف ويُخزن',
  visa_image_url: 'اختياري: رابط HTTPS لصورة صالحة إن وُجد',
  flight_ticket_image_url: 'اختياري: رابط HTTPS لصورة صالحة إن وُجد',
  personal_picture_url: 'اختياري: رابط HTTPS لصورة صالحة إن وُجد',
};

export function getTemplateInstructions(
  locale: 'en' | 'ar',
): Record<RecruitmentImportColumnKey, string> {
  return locale === 'ar' ? AR : EN;
}
