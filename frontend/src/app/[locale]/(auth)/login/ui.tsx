"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // Prevent default form submission
    setPending(true);
    setError(null);
    try {
      const formData = new FormData(e.currentTarget);
      const body = {
        company_slug: String(formData.get("company_slug") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
      };

      // Use absolute URL to avoid locale prefix issues
      const apiUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/auth/login`
        : '/api/auth/login';

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as any;
        throw new Error(data?.message ?? "Login failed");
      }

      const next = search.get("next");
      // Sanitize next parameter to avoid redirect loops
      const sanitizedNext = next && next !== "/login" && !next.startsWith("/login?") && next !== `/${locale}/login` && !next.startsWith(`/${locale}/login?`)
        ? next 
        : null;
      router.push(sanitizedNext || `/${locale}/dashboard`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-primary">
          {t("auth.companySlug")}
        </label>
        <input
          name="company_slug"
          required
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary">
          {t("auth.email")}
        </label>
        <input
          name="email"
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
          name="password"
          type="password"
          required
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
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </button>
    </form>
  );
}


