"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Lang, messages } from "@/lib/i18n/messages";

type LanguageContextValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (next: Lang) => void;
  toggleLang: () => void;
  t: (key: string, fallback?: string) => string;
};

const STORAGE_KEY = "trackify_lang";

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  dir: "ltr",
  setLang: () => undefined,
  toggleLang: () => undefined,
  t: (_key: string, fallback = "") => fallback,
});

function getNestedValue(source: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "ar" || saved === "en" ? saved : "en";
  });
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [dir, lang]);

  const value = useMemo<LanguageContextValue>(() => {
    const setLang = (next: Lang) => setLangState(next);
    const toggleLang = () => setLangState((prev) => (prev === "en" ? "ar" : "en"));
    const t = (key: string, fallback = key) => {
      const text = getNestedValue(messages[lang], key);
      return text ?? fallback;
    };
    return { lang, dir, setLang, toggleLang, t };
  }, [lang, dir]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

