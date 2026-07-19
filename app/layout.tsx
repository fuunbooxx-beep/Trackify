import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';
import { Cairo, Inter } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { RouteTitle } from '@/components/RouteTitle';
import Script from 'next/script';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: {
    default: 'Trackify | اتأكد قبل ما تدفع',
    template: '%s | Trackify',
  },
  description: 'ابحث برقم الهاتف أو اسم البائع أو رابط الصفحة، وشاهد البلاغات وتجارب العملاء قبل الدفع.',
  keywords: ['كشف النصب', 'تقييم البائعين', 'صفحات نصابة', 'متاجر الألعاب', 'Trackify Egypt'],
  metadataBase: new URL(process.env.APP_URL || 'https://trackify.app'),
  openGraph: {
    type: 'website',
    locale: 'ar_EG',
    alternateLocale: 'en_US',
    title: 'Trackify | اتأكد قبل ما تدفع',
    description: 'تحقق من البائع أو الصفحة قبل تحويل الأموال.',
  },
  icons: {
    icon: 'https://res.cloudinary.com/dv4qomvdt/image/upload/c_crop,g_center,w_400,h_400/c_fill,w_64,h_64/v1778340096/ChatGPT_Image_May_9_2026_06_21_15_PM_gwhs9o.png?tabicon=6',
    shortcut:
      'https://res.cloudinary.com/dv4qomvdt/image/upload/c_crop,g_center,w_400,h_400/c_fill,w_64,h_64/v1778340096/ChatGPT_Image_May_9_2026_06_21_15_PM_gwhs9o.png?tabicon=6',
    apple:
      'https://res.cloudinary.com/dv4qomvdt/image/upload/c_crop,g_center,w_400,h_400/c_fill,w_180,h_180/v1778340096/ChatGPT_Image_May_9_2026_06_21_15_PM_gwhs9o.png?tabicon=6',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`dark ${cairo.variable} ${inter.variable}`}>
      <body className="bg-background text-foreground antialiased min-h-screen flex flex-col">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  try {
    const key = "trackify_theme";
    const saved = window.localStorage.getItem(key);
    const theme = saved === "light" || saved === "dark" ? saved : "dark";
    if (!saved) window.localStorage.setItem(key, "dark");
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.classList.add("dark");
  }
})();
            `,
          }}
        />
        <Script
          id="scroll-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  try {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
    window.addEventListener("pageshow", () => window.scrollTo(0, 0));
  } catch {}
})();
            `,
          }}
        />
        <Script
          id="lang-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  try {
    const saved = window.localStorage.getItem("trackify_lang");
    const lang = saved === "ar" || saved === "en" ? saved : "en";
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  } catch {}
})();
            `,
          }}
        />
        <Providers>
          <RouteTitle />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
