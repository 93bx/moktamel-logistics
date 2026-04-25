import { ReportCatalogItem } from './reports.types';

const commonDateFilters = [
  { key: 'date_from', type: 'date', label_code: 'REPORTS_FILTER_DATE_FROM' },
  { key: 'date_to', type: 'date', label_code: 'REPORTS_FILTER_DATE_TO' },
] as const;

export const REPORTS_REGISTRY: ReportCatalogItem[] = [
  {
    key: 'daily-operations',
    tab: 'operations',
    title_code: 'REPORTS_DAILY_OPERATIONS_TITLE',
    description_code: 'REPORTS_DAILY_OPERATIONS_DESC',
    permission: 'DAILY_OPS_READ',
    filters: [
      ...commonDateFilters,
      { key: 'employee_id', type: 'text', label_code: 'REPORTS_FILTER_EMPLOYEE' },
    ],
    preview_columns: [
      { key: 'date', label_code: 'COMMON_DATE' },
      { key: 'employee_name', label_code: 'COMMON_EMPLOYEE' },
      { key: 'orders_count', label_code: 'REPORTS_ORDERS' },
      { key: 'total_revenue', label_code: 'REPORTS_REVENUE' },
      { key: 'work_hours', label_code: 'REPORTS_WORK_HOURS' },
    ],
    export_columns: [
      { key: 'employee_code', label_code: 'COMMON_EMPLOYEE_CODE' },
      { key: 'cash_collected', label_code: 'REPORTS_CASH_COLLECTED' },
      { key: 'cash_received', label_code: 'REPORTS_CASH_RECEIVED' },
      { key: 'tips', label_code: 'REPORTS_TIPS' },
      { key: 'deduction_amount', label_code: 'REPORTS_DEDUCTIONS' },
    ],
  },
];

const additionalReports: Array<Omit<ReportCatalogItem, 'filters' | 'preview_columns' | 'export_columns'>> = [
  { key: 'employee-performance', tab: 'operations', title_code: 'REPORTS_EMPLOYEE_PERFORMANCE_TITLE', description_code: 'REPORTS_EMPLOYEE_PERFORMANCE_DESC', permission: 'DAILY_OPS_READ' },
  { key: 'platform', tab: 'operations', title_code: 'REPORTS_PLATFORM_TITLE', description_code: 'REPORTS_PLATFORM_DESC', permission: 'HR_EMPLOYMENT_READ' },
  { key: 'working-days', tab: 'operations', title_code: 'REPORTS_WORKING_DAYS_TITLE', description_code: 'REPORTS_WORKING_DAYS_DESC', permission: 'DAILY_OPS_READ' },
  { key: 'tips-deductions', tab: 'operations', title_code: 'REPORTS_TIPS_DEDUCTIONS_TITLE', description_code: 'REPORTS_TIPS_DEDUCTIONS_DESC', permission: 'DAILY_OPS_READ' },
  { key: 'revenue', tab: 'finance', title_code: 'REPORTS_REVENUE_TITLE', description_code: 'REPORTS_REVENUE_DESC', permission: 'DAILY_OPS_READ' },
  { key: 'costs', tab: 'finance', title_code: 'REPORTS_COSTS_TITLE', description_code: 'REPORTS_COSTS_DESC', permission: 'COSTS_READ' },
  { key: 'cash', tab: 'finance', title_code: 'REPORTS_CASH_TITLE', description_code: 'REPORTS_CASH_DESC', permission: 'DAILY_OPS_READ' },
  { key: 'cash-custody', tab: 'finance', title_code: 'REPORTS_CASH_CUSTODY_TITLE', description_code: 'REPORTS_CASH_CUSTODY_DESC', permission: 'FIN_CASH_LOANS_READ' },
  { key: 'loans', tab: 'finance', title_code: 'REPORTS_LOANS_TITLE', description_code: 'REPORTS_LOANS_DESC', permission: 'FIN_CASH_LOANS_READ' },
  { key: 'salaries', tab: 'finance', title_code: 'REPORTS_SALARIES_TITLE', description_code: 'REPORTS_SALARIES_DESC', permission: 'PAYROLL_VIEW' },
  { key: 'employees', tab: 'hr', title_code: 'REPORTS_EMPLOYEES_TITLE', description_code: 'REPORTS_EMPLOYEES_DESC', permission: 'HR_EMPLOYMENT_READ' },
  { key: 'attendance', tab: 'hr', title_code: 'REPORTS_ATTENDANCE_TITLE', description_code: 'REPORTS_ATTENDANCE_DESC', permission: 'DAILY_OPS_READ' },
  { key: 'contracts', tab: 'hr', title_code: 'REPORTS_CONTRACTS_TITLE', description_code: 'REPORTS_CONTRACTS_DESC', permission: 'HR_EMPLOYMENT_READ' },
  { key: 'vehicles', tab: 'hr', title_code: 'REPORTS_VEHICLES_TITLE', description_code: 'REPORTS_VEHICLES_DESC', permission: 'FLEET_READ' },
  { key: 'maintenance', tab: 'hr', title_code: 'REPORTS_MAINTENANCE_TITLE', description_code: 'REPORTS_MAINTENANCE_DESC', permission: 'FLEET_MAINTENANCE' },
  { key: 'gas', tab: 'hr', title_code: 'REPORTS_GAS_TITLE', description_code: 'REPORTS_GAS_DESC', permission: 'FLEET_GAS' },
  { key: 'assets', tab: 'docs_assets', title_code: 'REPORTS_ASSETS_TITLE', description_code: 'REPORTS_ASSETS_DESC', permission: 'HR_ASSETS_READ' },
  { key: 'documents', tab: 'docs_assets', title_code: 'REPORTS_DOCUMENTS_TITLE', description_code: 'REPORTS_DOCUMENTS_DESC', permission: 'HR_EMPLOYMENT_READ' },
];

for (const item of additionalReports) {
  REPORTS_REGISTRY.push({
    ...item,
    filters: [...commonDateFilters],
    preview_columns: [
      { key: 'label', label_code: 'COMMON_NAME' },
      { key: 'value', label_code: 'COMMON_VALUE' },
    ],
    export_columns: [
      { key: 'label', label_code: 'COMMON_NAME' },
      { key: 'value', label_code: 'COMMON_VALUE' },
      { key: 'created_at', label_code: 'COMMON_CREATED_AT' },
    ],
  });
}
