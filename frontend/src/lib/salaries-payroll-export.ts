export async function downloadSalariesPayrollExport(searchParams: {
  month: string;
  status?: string;
  search?: string;
  sort?: string;
  locale?: "en" | "ar";
}): Promise<void> {
  const params = new URLSearchParams();
  params.set("month", searchParams.month);
  if (searchParams.status && searchParams.status !== "ALL") {
    params.set("status", searchParams.status);
  }
  if (searchParams.search) params.set("search", searchParams.search);
  if (searchParams.sort) params.set("sort", searchParams.sort);
  if (searchParams.locale) params.set("locale", searchParams.locale);

  const res = await fetch(`/api/salaries-payroll/export?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Export failed");
  }
  const blob = await res.blob();
  const dispo = res.headers.get("content-disposition");
  let name = "salaries-payroll-export.xlsx";
  const m = dispo?.match(/filename="([^"]+)"/);
  if (m) name = m[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
