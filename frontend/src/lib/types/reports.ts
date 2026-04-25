export type ReportTabKey = "operations" | "finance" | "hr" | "docs_assets";

export type ReportFilter = {
  key: string;
  type: "text" | "select" | "number" | "date" | "daterange";
  label_code: string;
  options?: Array<{ value: string; label_code: string }>;
};

export type ReportColumn = {
  key: string;
  label_code: string;
};

export type ReportCatalogItem = {
  key: string;
  tab: ReportTabKey;
  title_code: string;
  description_code: string;
  permission: string;
  filters: ReportFilter[];
  preview_columns: ReportColumn[];
  export_columns: ReportColumn[];
};

export type ReportDataResponse = {
  key: string;
  summary: Record<string, string | number | null>;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | boolean | null>>;
  totalRows: number;
  appliedFilters: Record<string, unknown>;
};
