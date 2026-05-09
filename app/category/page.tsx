"use client";

import { Navbar } from "@/components/Navbar";
import { AuthContext } from "@/lib/providers";
import { isAdminUser } from "@/lib/auth-user";
import { useLanguage } from "@/lib/i18n/context";
import {
  getTargetCategoryDescription,
  getTargetCategoryLabel,
  getTargetHref,
  getTargetLinks,
  getTargetPhones,
  normalizeTargetCategory,
  TARGET_CATEGORY_OPTIONS,
  type TargetRecord,
} from "@/lib/target-utils";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Layers, Loader2, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useContext, useEffect, useMemo, useState } from "react";

type TargetWithId = TargetRecord & { id: string };

export default function CategoryPage() {
  const { lang } = useLanguage();
  const { user } = useContext(AuthContext);
  const isAdmin = isAdminUser(user);
  const [targets, setTargets] = useState<TargetWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    const fetchTargets = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "targets"));
        const data = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as TargetWithId))
          .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
        setTargets(data);
      } catch (error) {
        console.error(error);
        setTargets([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchTargets();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = decodeURIComponent(window.location.hash.replace(/^#/, "").trim());
    if (!raw) return;
    const slug = TARGET_CATEGORY_OPTIONS.some((option) => option.value === raw) ? raw : normalizeTargetCategory(raw);
    if (!TARGET_CATEGORY_OPTIONS.some((option) => option.value === slug)) return;
    queueMicrotask(() => {
      setActiveCategory(slug);
      window.requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    });
  }, []);

  const categoryStats = useMemo(() => {
    return TARGET_CATEGORY_OPTIONS.map((option) => ({
      ...option,
      count: targets.filter((target) => String(target.category || "gaming") === option.value).length,
    }));
  }, [targets]);

  const targetSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return [];

    return targets
      .filter((target) => {
      const category = String(target.category || "gaming");
      const categoryMatch = activeCategory === "all" || category === activeCategory;
      if (!categoryMatch) return false;
      const nameMatch = String(target.name || "").toLowerCase().includes(q);
      const idMatch = String(target.id || "").toLowerCase().includes(q);
      const phoneMatch = getTargetPhones(target).some((phone) => phone.toLowerCase().includes(q));
      const linkMatch = getTargetLinks(target).some((link) => String(link.url || "").toLowerCase().includes(q));
      return nameMatch || idMatch || phoneMatch || linkMatch;
      })
      .slice(0, 10);
  }, [targets, activeCategory, query]);

  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-28">
        <section className="glass-panel rounded-3xl p-6 md:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black md:text-4xl">
                {lang === "ar" ? "تصنيفات الصفحات" : "Page categories"}
              </h1>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {lang === "ar"
                  ? "اختار الفئة المناسبة بسرعة واعرف الصفحات الموجودة تحت كل تصنيف."
                  : "Browse categories and discover which targets belong to each one."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {categoryStats.map((category) => (
              <button
                key={category.value}
                id={category.value}
                type="button"
                onClick={() => setActiveCategory(category.value)}
                className={`rounded-2xl border p-4 text-start transition hover:-translate-y-0.5 ${
                  activeCategory === category.value
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-background/70 hover:border-primary/25"
                }`}
              >
                <p className="text-sm font-black">{lang === "ar" ? category.labelAr : category.labelEn}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {getTargetCategoryDescription(category.value, lang)}
                </p>
                <p className="mt-3 text-2xl font-black">{category.count}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 glass-panel rounded-3xl p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xl">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input ps-9"
                placeholder={lang === "ar" ? "ابحث بالاسم أو ID..." : "Search by name or ID..."}
              />
            </div>
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold hover:bg-secondary"
            >
              {lang === "ar" ? "عرض كل الفئات" : "Show all categories"}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{lang === "ar" ? "جاري تحميل الفئات..." : "Loading categories..."}</span>
            </div>
          ) : query.trim().length < 1 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-8 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-bold">{lang === "ar" ? "اكتب حرف واحد أو أكثر لعرض اقتراحات الصفحات." : "Type one or more characters to show target suggestions."}</p>
            </div>
          ) : targetSuggestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-8 text-center">
              <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-bold">{lang === "ar" ? "لا توجد صفحات مطابقة." : "No matching targets found."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {targetSuggestions.map((target) => {
                const firstPhone = getTargetPhones(target)[0];
                const firstLink = getTargetLinks(target)[0];
                return (
                  <div
                    key={target.id}
                    className="rounded-2xl border border-border bg-background/70 p-3 transition hover:-translate-y-0.5 hover:border-primary/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Link href={getTargetHref(target)} className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-secondary">
                          {target.logoUrl ? (
                            <img src={target.logoUrl} alt={target.name || ""} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[10px] font-black text-muted-foreground">N/A</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-black">{target.name || target.id}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground" dir="ltr">
                            {firstPhone || firstLink?.url || target.id}
                          </p>
                          <span className="mt-2 inline-flex shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-black text-primary dark:text-neon-blue">
                            {getTargetCategoryLabel(normalizeTargetCategory(target.category), lang)}
                          </span>
                        </div>
                      </Link>

                      {isAdmin && (
                        <Link
                          href={`/dashboard?edit=${target.id}`}
                          className="shrink-0 rounded-xl bg-secondary px-3 py-2 text-xs font-bold hover:bg-secondary/70"
                        >
                          {lang === "ar" ? "تعديل" : "Edit"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
