import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;

  if (!access) {
    redirect(`/${locale}/login`);
  }

  redirect(`/${locale}/dashboard`);
}


