/** List item shape from GET /hr/employment/records (and used by EmploymentPageClient) */
export type EmploymentListItem = {
  id: string;
  recruitment_candidate_id: string | null;
  employee_no: string | null;
  employee_code: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  iqama_no: string | null;
  custody_status: string | null;
  start_date_at: string | null;
  contract_end_at: string | null;
  iqama_expiry_at: string | null;
  passport_expiry_at: string | null;
  medical_expiry_at: string | null;
  license_expiry_at: string | null;
  status_code: string;
  salary_amount: string | null;
  salary_currency_code: string | null;
  target_type: "TARGET_TYPE_ORDERS" | "TARGET_TYPE_REVENUE" | null;
  target_deduction_type: string | null;
  monthly_orders_target: number | null;
  monthly_target_amount: string | null;
  day_work_hours?: string | null;
  work_days?: string[] | null;
  cost_center_code: string | null;
  assigned_platform: string | null;
  platform_user_no: string | null;
  avatar_file_id: string | null;
  assets?: Array<{ id: string; asset: { type: string; name: string } }>;
  created_at: string;
  updated_at: string;
  recruitment_candidate: {
    full_name_ar: string;
    full_name_en: string | null;
  } | null;
};

/** Full employment record from GET /hr/employment/:id (for View modal) */
export type EmploymentFull = EmploymentListItem & {
  nationality: string | null;
  phone: string | null;
  date_of_birth: string | null;
  passport_no: string | null;
  passport_expiry_at: string | null;
  passport_file_id: string | null;
  iqama_no: string | null;
  iqama_expiry_at: string | null;
  iqama_file_id: string | null;
  contract_no: string | null;
  contract_end_at: string | null;
  contract_file_id: string | null;
  license_expiry_at: string | null;
  license_file_id: string | null;
  promissory_note_file_id: string | null;
  job_type: string | null;
  platform_user_no: string | null;
  notes: string | null;
};
