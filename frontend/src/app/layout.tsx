import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import { defaultLocale, isLocale } from "@/i18n/routing";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
  const initialLocale = isLocale(localeCookie ?? "") ? localeCookie : defaultLocale;
  const initialDir = initialLocale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={initialLocale} dir={initialDir} suppressHydrationWarning>
      <head>
        <Script id="set-html-dir-before-hydration" strategy="beforeInteractive">
          {`(() => {
  const pathLocale = window.location.pathname.split("/")[1];
  const fromPath = pathLocale === "ar" || pathLocale === "en" ? pathLocale : null;
  const cookieMatch = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
  const cookieLocale = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  const fromCookie = cookieLocale === "ar" || cookieLocale === "en" ? cookieLocale : null;
  const locale = fromPath || fromCookie || "${defaultLocale}";
  const dir = locale === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
})();`}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
