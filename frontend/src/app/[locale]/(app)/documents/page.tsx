import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { backendApi, AuthError, ConfigurationError } from "@/lib/backendApi";
import { DocumentsPageClient } from "@/components/DocumentsPageClient";

export type DocumentsStatsData = {
  expiringWithin5: number;
  expiringWithin25: number;
  expired: number;
  active: number;
};

export type DocumentListItem = {
  id: string;
  doc_name: string;
  source_type: "employment" | "company" | "fleet" | "recruitment" | "other";
  source_label: string;
  expiry_date: string | null;
  status: "active" | "near_expiry" | "expired" | "no_expiry";
  entity_type: string;
  entity_id: string;
  document_id: string;
  file_id: string | null;
  file_url?: string | null;
  employment_record_id?: string;
  vehicle_id?: string;
  recruitment_candidate_id?: string;
};

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  const tab = sp.tab || "near_expiry";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 25;

  let stats: DocumentsStatsData;
  let listData: { items: DocumentListItem[]; total: number; page: number; page_size: number };

  try {
    const listParams = new URLSearchParams();
    listParams.set("tab", tab);
    listParams.set("page", String(page));
    listParams.set("page_size", String(pageSize));
    if (sp.q?.trim()) listParams.set("q", sp.q.trim());

    [stats, listData] = await Promise.all([
      backendApi<DocumentsStatsData>({ path: "/documents/stats" }),
      backendApi<{ items: DocumentListItem[]; total: number; page: number; page_size: number }>({
        path: `/documents/list?${listParams.toString()}`,
      }),
    ]);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    if (error instanceof ConfigurationError) {
      console.error("Configuration error in documents page:", error.message, error.details);
      throw new Error(
        `Configuration Error: ${error.message}. Please check your environment variables.`
      );
    }
    throw error;
  }

  return (
    <div className="space-y-4">
      <DocumentsPageClient
        locale={locale}
        stats={stats}
        initialData={listData}
        searchParams={{ tab, page, q: sp.q ?? "" }}
      />
    </div>
  );
}
