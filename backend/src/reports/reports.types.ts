export type ReportTabKey = 'operations' | 'finance' | 'hr' | 'docs_assets';

export type ReportExportFormat = 'xlsx' | 'pdf';

export type ReportFilterDefinition = {
  key: string;
  type: 'text' | 'select' | 'number' | 'date' | 'daterange';
  label_code: string;
  options?: Array<{ value: string; label_code: string }>;
};

export type ReportColumnDefinition = {
  key: string;
  label_code: string;
};

export type ReportCatalogItem = {
  key: string;
  tab: ReportTabKey;
  title_code: string;
  description_code: string;
  permission: string;
  filters: ReportFilterDefinition[];
  preview_columns: ReportColumnDefinition[];
  export_columns: ReportColumnDefinition[];
};

export type ReportDataResponse = {
  key: string;
  summary: Record<string, number | string | null>;
  columns: ReportColumnDefinition[];
  rows: Array<Record<string, string | number | boolean | null>>;
  totalRows: number;
  appliedFilters: Record<string, unknown>;
};
