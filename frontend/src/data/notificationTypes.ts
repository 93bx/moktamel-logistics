/**
 * Registry of notification type codes to display name, descriptions, relevant page, and action.
 * Used for both the Notifications page table and the header dropdown.
 */
export type NotificationTypeConfig = {
  nameKey: string;
  shortDescriptionKey: string;
  longDescriptionKey: string;
  relevantPage: (locale: string, payload: Record<string, unknown>) => string;
  actionLabelKey: string;
};

const configs: Record<string, NotificationTypeConfig> = {
  HR_RECRUITMENT_VISA_DEADLINE_SOON: {
    nameKey: "notifications.types.HR_RECRUITMENT_VISA_DEADLINE_SOON.name",
    shortDescriptionKey:
      "notifications.types.HR_RECRUITMENT_VISA_DEADLINE_SOON.shortDescription",
    longDescriptionKey:
      "notifications.types.HR_RECRUITMENT_VISA_DEADLINE_SOON.longDescription",
    relevantPage: (locale, payload) => {
      const id = payload?.candidate_id as string | undefined;
      return id ? `/${locale}/recruitment/${id}` : `/${locale}/recruitment`;
    },
    actionLabelKey:
      "notifications.types.HR_RECRUITMENT_VISA_DEADLINE_SOON.actionLabel",
  },
  HR_EMPLOYMENT_IQAMA_EXPIRY_SOON: {
    nameKey: "notifications.types.HR_EMPLOYMENT_IQAMA_EXPIRY_SOON.name",
    shortDescriptionKey:
      "notifications.types.HR_EMPLOYMENT_IQAMA_EXPIRY_SOON.shortDescription",
    longDescriptionKey:
      "notifications.types.HR_EMPLOYMENT_IQAMA_EXPIRY_SOON.longDescription",
    relevantPage: (locale) => `/${locale}/employment`,
    actionLabelKey:
      "notifications.types.HR_EMPLOYMENT_IQAMA_EXPIRY_SOON.actionLabel",
  },
  HR_ASSETS_PENDING_RECOVERY: {
    nameKey: "notifications.types.HR_ASSETS_PENDING_RECOVERY.name",
    shortDescriptionKey:
      "notifications.types.HR_ASSETS_PENDING_RECOVERY.shortDescription",
    longDescriptionKey:
      "notifications.types.HR_ASSETS_PENDING_RECOVERY.longDescription",
    relevantPage: (locale) => `/${locale}/assets`,
    actionLabelKey: "notifications.types.HR_ASSETS_PENDING_RECOVERY.actionLabel",
  },
  HR_ASSETS_LOSS_REPORT_APPROVAL_REQUIRED: {
    nameKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_APPROVAL_REQUIRED.name",
    shortDescriptionKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_APPROVAL_REQUIRED.shortDescription",
    longDescriptionKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_APPROVAL_REQUIRED.longDescription",
    relevantPage: (locale) => `/${locale}/assets`,
    actionLabelKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_APPROVAL_REQUIRED.actionLabel",
  },
  HR_ASSETS_LOSS_REPORT_APPROVED: {
    nameKey: "notifications.types.HR_ASSETS_LOSS_REPORT_APPROVED.name",
    shortDescriptionKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_APPROVED.shortDescription",
    longDescriptionKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_APPROVED.longDescription",
    relevantPage: (locale) => `/${locale}/assets`,
    actionLabelKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_APPROVED.actionLabel",
  },
  HR_ASSETS_LOSS_REPORT_REJECTED: {
    nameKey: "notifications.types.HR_ASSETS_LOSS_REPORT_REJECTED.name",
    shortDescriptionKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_REJECTED.shortDescription",
    longDescriptionKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_REJECTED.longDescription",
    relevantPage: (locale) => `/${locale}/assets`,
    actionLabelKey:
      "notifications.types.HR_ASSETS_LOSS_REPORT_REJECTED.actionLabel",
  },
};

export function getNotificationTypeConfig(
  typeCode: string
): NotificationTypeConfig | null {
  return configs[typeCode] ?? null;
}

export function getRelevantPage(
  typeCode: string,
  locale: string,
  payload: Record<string, unknown> | null
): string {
  const config = getNotificationTypeConfig(typeCode);
  if (!config) return `/${locale}/notifications`;
  return config.relevantPage(locale, payload ?? {});
}
