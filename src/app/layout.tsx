import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import { TranslationsProvider } from "../i18n/client";
import { getLocale, getT } from "../i18n/server";
import { SPLASH_SCREENS } from "../components/pwa/splash-links";
import { ServiceWorkerRegistration } from "../components/service-worker-registration";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('Metadata');
  return {
    title: "TwinCap",
    description: t('description'),
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "TwinCap",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('twincap-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        {/* React 19 hoists these <link> elements into <head>. */}
        {SPLASH_SCREENS.map(({ media, href }) => (
          <link
            key={href}
            rel="apple-touch-startup-image"
            media={media}
            href={href}
          />
        ))}
        <ServiceWorkerRegistration />
        <ThemeProvider>
          <TranslationsProvider messages={messages} locale={locale}>
            {children}
          </TranslationsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
