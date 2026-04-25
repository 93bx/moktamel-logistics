import { ReportCatalogItem, ReportDataResponse } from "./types/reports";

export async function fetchReportsCatalog(): Promise<ReportCatalogItem[]> {
  const res = await fetch("/api/reports/catalog", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load reports catalog");
  return res.json();
}

export async function fetchReportPreview(
  key: string,
  filters: Record<string, string>,
): Promise<ReportDataResponse> {
  const params = new URLSearchParams(filters);
  const res = await fetch(`/api/reports/${key}/data?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load report");
  return res.json();
}

export function buildReportExportUrl(
  key: string,
  format: "xlsx" | "pdf",
  filters: Record<string, string>,
) {
  const params = new URLSearchParams(filters);
  params.set("format", format);
  return `/api/reports/${key}/export?${params.toString()}`;
}
