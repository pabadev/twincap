import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TranslationsProvider } from "../i18n/client";
import { getLocale } from "../i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GlobalMoney",
  description: "Personal finance management",
};

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = (
    await import(`../../messages/${locale}.json`)
  ).default;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TranslationsProvider messages={messages} locale={locale}>
          {children}
        </TranslationsProvider>
      </body>
    </html>
  );
}
