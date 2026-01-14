"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SignupForm({ locale }: { locale: string }) {
  const t = useTranslations();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const body = {
        company_name: String(formData.get("company_name") || ""),
        company_slug: String(formData.get("company_slug") || ""),
        owner_email: String(formData.get("owner_email") || ""),
        owner_password: String(formData.get("owner_password") || ""),
        owner_name: String(formData.get("owner_name") || ""),
        owner_phone: String(formData.get("owner_phone") || ""),
      };

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as any;
        throw new Error(data?.message ?? "Sign up failed");
      }

      const next = search.get("next");
      router.push(next || `/${locale}/dashboard`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Sign up failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-primary">
          {t("auth.companyName")}
        </label>
        <input
          name="company_name"
          required
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary">
          {t("auth.companySlug")}
        </label>
        <input
          name="company_slug"
          required
          pattern="[a-z0-9-]+"
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="mt-1 text-xs text-primary/60">
          {t("auth.companySlugHint")}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary">
          {t("auth.email")}
        </label>
        <input
          name="owner_email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary">
          {t("auth.password")}
        </label>
        <input
          name="owner_password"
          type="password"
          required
          minLength={12}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="mt-1 text-xs text-primary/60">
          {t("auth.passwordHint")}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary">
          {t("auth.name")} {t("common.optional")}
        </label>
        <input
          name="owner_name"
          type="text"
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary">
          {t("auth.phone")} {t("common.optional")}
        </label>
        <input
          name="owner_phone"
          type="tel"
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-100">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? t("auth.signingUp") : t("auth.signUp")}
      </button>
    </form>
  );
}

