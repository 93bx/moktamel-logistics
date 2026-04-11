export type PayrollEmployeeStatus = 'PAID' | 'NOT_PAID';

export interface SalariesPayrollQuickStats {
  activeEmployeesCount: number;
  totalLoansAmount: number;
  totalDeductionsAmount: number;
  totalSalariesDueAmount: number;
  totalRevenueAmount: number;
  totalUncollectedCashAmount: number;
}

export interface SalariesPayrollRow {
  id: string;
  company_id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name_en: string | null;
  employee_name_ar: string | null;
  employee_avatar_url: string | null;
  status: PayrollEmployeeStatus;
  base_salary: number;
  monthly_target: number;
  orders_count: number;
  working_days: number;
  target_difference: number;
  deduction_method: string;
  total_deductions: number;
  scheduled_loan_installments: number;
  total_outstanding_loans: number;
  total_unreceived_cash: number;
  total_bonus: number;
  salary_after_deductions: number;
  total_revenue: number;
  average_cost: number;
  operations_deductions_total?: number;
  carryover_adjustment_sar?: number;
  calculation_details: any;
  created_at: string;
  updated_at: string;
  employee?: {
    assigned_platform: string | null;
    platform_user_no: string | null;
    target_type: string | null;
    target_deduction_type: string | null;
    monthly_orders_target: number | null;
    monthly_target_amount: string | number | null;
    salary_amount?: string | number | null;
  };
}

export interface ListSalariesResponse {
  needsApproval?: boolean;
  month?: string;
  quickStats: SalariesPayrollQuickStats;
  items: SalariesPayrollRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export type SalaryReceiptDifferenceProcessing =
  | 'DEFERRAL_TO_NEXT_MONTH'
  | 'ADMIN_EXEMPTION'
  | 'MANUAL';

export interface CreateSalaryReceiptInput {
  amount: number;
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'OTHER';
  paymentDate: string;
  attachmentUrl?: string;
  differenceProcessing?: SalaryReceiptDifferenceProcessing;
  differenceManualDetail?: string;
  notes?: string;
}

export type PayrollSortKey =
  | 'default'
  | 'revenue'
  | 'salary_due'
  | 'deductions'
  | 'loans';

