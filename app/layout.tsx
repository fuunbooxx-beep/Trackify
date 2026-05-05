import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';
import { Cairo, Inter } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
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
  title: 'Trackify - Detect Scam Gaming Pages & Sellers',
  description: 'Trackify helps detect scam gaming pages and sellers with trust scores and user reports.',
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
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
