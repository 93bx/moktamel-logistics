import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ApiError, AuthError, backendApi, ConfigurationError } from "@/lib/backendApi";
import { ProfilePageClient } from "@/components/ProfilePageClient";

export type ProfileMePayload = {
  user: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    role: string;
    profile_picture_url: string | null;
  };
  company: {
    name: string;
    email: string | null;
    address: string | null;
    logo_url: string | null;
  };
  permissions: {
    can_edit_user_info: boolean;
  };
};

export type ProfileHistoryPayload = {
  items: Array<{
    id: string;
    action: string;
    created_at: string;
    actor_user_id: string | null;
    actor_role: string | null;
    entity_type: string;
    entity_id: string | null;
    metadata?: {
      old_values?: unknown;
      new_values?: unknown;
    };
  }>;
  total: number;
  limit: number;
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await getTranslations({ locale });

  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  let me: ProfileMePayload;
  let history: ProfileHistoryPayload;
  try {
    [me, history] = await Promise.all([
      backendApi<ProfileMePayload>({ path: "/profile/me" }),
      backendApi<ProfileHistoryPayload>({ path: "/profile/history?limit=10" }),
    ]);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    if (error instanceof ConfigurationError) {
      throw new Error(`Configuration Error: ${error.message}`);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw error;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="p-4 sm:p-6">
        <ProfilePageClient initialMe={me} initialHistory={history} />
      </div>
    </div>
  );
}
