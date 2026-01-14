import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SignupForm } from "./ui";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center bg-white dark:bg-black px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <h1 className="text-xl font-semibold text-primary">
          {t("auth.signupTitle")}
        </h1>
        <div className="mt-4">
          <SignupForm locale={locale} />
        </div>
        <div className="mt-4 text-center text-sm text-primary/80">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link
            href={`/${locale}/login`}
            className="font-medium text-primary hover:underline hover:text-primary-600"
          >
            {t("auth.signIn")}
          </Link>
        </div>
      </div>
    </div>
  );
}

