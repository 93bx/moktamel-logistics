import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LocaleHtmlAttributes } from "@/components/LocaleHtmlAttributes";
import { ThemeProvider } from "@/components/ThemeProvider";
import { isLocale } from "@/i18n/routing";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ar" }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bfa58f2a-7ab1-463f-905a-0dfca7fc2a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'[locale]/layout.tsx:19',message:'LocaleLayout locale from params',data:{locale},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion

  // Ensure we're using the correct locale from params, not from request
  const messages = await getMessages({ locale });

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bfa58f2a-7ab1-463f-905a-0dfca7fc2a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'[locale]/layout.tsx:24',message:'Messages loaded',data:{locale,messageKeys:Object.keys(messages),sampleMessage:JSON.stringify(messages.app||{}).substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  return (
    <ThemeProvider>
      <NextIntlClientProvider messages={messages} locale={locale}>
        <LocaleHtmlAttributes locale={locale} />
        {children}
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}


