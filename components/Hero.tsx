"use client";

import { collection, getDocs } from "firebase/firestore";
import { Gamepad2, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/lib/i18n/context";
import { scoreTarget } from "@/lib/target-search-score";
import type { TargetRecord } from "@/lib/target-utils";

type CatalogTarget = TargetRecord & { id: string };
type PopularSearch = { label: string; query: string };

const gameTiles = [
  { name: "PUBG Mobile", className: "hero-game-card--pubg" },
  { name: "Free Fire", className: "hero-game-card--freefire" },
  { name: "Valorant", className: "hero-game-card--valorant" },
  { name: "PlayStation", className: "hero-game-card--playstation" },
  { name: "EA SPORTS FC", className: "hero-game-card--fc" },
  { name: "Fortnite", className: "hero-game-card--fortnite" },
  { name: "Roblox", className: "hero-game-card--roblox" },
  { name: "Steam", className: "hero-game-card--steam" },
  { name: "Mobile Legends", className: "hero-game-card--legends" },
  { name: "Call of Duty", className: "hero-game-card--cod" },
  { name: "League of Legends", className: "hero-game-card--lol" },
  { name: "Minecraft", className: "hero-game-card--minecraft" },
];

export function Hero() {
  const [query, setQuery] = useState("");
  const [catalogTargets, setCatalogTargets] = useState<CatalogTarget[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const listId = `hero-search-${useId().replace(/:/g, "")}`;
  const router = useRouter();
  const { lang } = useLanguage();
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let alive = true;
    void getDocs(collection(db, "targets"))
      .then((snapshot) => {
        if (alive) setCatalogTargets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CatalogTarget)));
      })
      .catch(console.error);
    return () => { alive = false; };
  }, []);

  const suggestions = useMemo(() => {
    const value = deferredQuery.trim();
    if (!value) return [];
    return catalogTargets
      .map((target) => ({ target, score: scoreTarget(value, target) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || Number(b.target.reportCount || 0) - Number(a.target.reportCount || 0))
      .slice(0, 8)
      .map(({ target }) => target);
  }, [catalogTargets, deferredQuery]);

  const fallbackSearches: PopularSearch[] = lang === "ar"
    ? [
        { label: "حسابات ببجي", query: "حسابات ببجي" },
        { label: "شحن شدات", query: "شحن شدات" },
        { label: "متاجر بلايستيشن", query: "متاجر بلايستيشن" },
        { label: "بطاقات ستيم", query: "بطاقات ستيم" },
      ]
    : [
        { label: "PUBG accounts", query: "PUBG accounts" },
        { label: "UC top-up", query: "UC top-up" },
        { label: "PlayStation stores", query: "PlayStation stores" },
        { label: "Steam cards", query: "Steam cards" },
      ];

  const popularSearches = useMemo(() => {
    const rows = catalogTargets
      .filter((target) => String(target.name || "").trim())
      .sort((a, b) => Number(b.reportCount || 0) - Number(a.reportCount || 0))
      .slice(0, 4)
      .map((target) => ({ label: String(target.name), query: String(target.name) }));
    return rows.length ? rows : fallbackSearches;
  }, [catalogTargets, lang]);

  const goToSearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const pickSuggestion = (value: string) => {
    setQuery(value);
    setInputFocused(false);
    goToSearch(value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setInputFocused(false);
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, -1));
    }
    if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      pickSuggestion(String(suggestions[activeSuggestion]?.name || ""));
    }
  };

  const showSuggestions = inputFocused && query.trim().length > 0 && suggestions.length > 0;

  return (
    <section className="home-hero relative flex min-h-[720px] items-center justify-center overflow-hidden bg-[#07090d] px-4 pb-20 pt-28 text-white sm:min-h-[780px] sm:px-6 sm:pt-32">
      <div className="hero-game-wall" aria-hidden="true">
        {gameTiles.map((game, index) => (
          <motion.div
            key={game.name}
            className={`hero-game-card ${game.className}`}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: index * 0.035 }}
          >
            <Gamepad2 className="h-8 w-8" />
            <span>{game.name}</span>
          </motion.div>
        ))}
      </div>
      <div className="hero-cinematic-overlay absolute inset-0" aria-hidden="true" />

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs font-bold text-white/75 backdrop-blur-md sm:text-sm">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {lang === "ar" ? "مجتمع أكثر أمانًا للاعبين في مصر" : "Safer gaming deals across Egypt"}
        </div>

        <h1 className="max-w-[900px] text-[clamp(2.7rem,7vw,5.7rem)] font-black leading-[0.98] tracking-[-0.055em]">
          {lang === "ar" ? "اتأكد قبل ما " : "Check before you "}
          <span className="hero-title-accent">{lang === "ar" ? "تدفع." : "pay."}</span>
        </h1>
        <p className="mt-6 max-w-2xl text-sm font-medium leading-7 text-white/65 sm:text-lg">
          {lang === "ar"
            ? "ابحث برقم الهاتف أو اسم البائع أو رابط الصفحة، وشوف تقييم الثقة وتجارب الناس قبل أي معاملة."
            : "Search a phone number r, seller name, or page link. See trust scores and real reports before making a gaming deal."}
        </p>

        <form
          onSubmit={(event) => { event.preventDefault(); goToSearch(query); }}
          className="relative mt-9 w-full max-w-3xl sm:mt-11"
        >
          <div className="hero-search-shell">
            <Search className="ms-2 hidden h-5 w-5 shrink-0 text-white/40 sm:block" />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActiveSuggestion(-1); }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => window.setTimeout(() => setInputFocused(false), 120)}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3 py-4 text-sm font-semibold text-white outline-none placeholder:text-white/35 sm:px-4 sm:py-5 sm:text-base"
              placeholder={lang === "ar" ? "رقم الهاتف، اسم البائع أو رابط الصفحة..." : "Phone number, seller name or page URL..."}
            />
            <button type="submit" aria-label={lang === "ar" ? "بحث" : "Search"} className="hero-search-button">
              <Search className="h-5 w-5" />
              <span className="hidden sm:inline">{lang === "ar" ? "ابحث" : "Search"}</span>
            </button>
          </div>

          {showSuggestions && (
            <div id={listId} role="listbox" className="hero-suggestion-panel">
              {suggestions.map((target, index) => (
                <button
                  key={target.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeSuggestion}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveSuggestion(index)}
                  onClick={() => pickSuggestion(String(target.name || ""))}
                  className={index === activeSuggestion ? "is-active" : ""}
                >
                  <Search className="h-4 w-4 text-primary" />
                  <span>{String(target.name || "")}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white/45">
            <TrendingUp className="h-4 w-4 text-primary" />
            {lang === "ar" ? "الأكثر بحثًا" : "Trending searches"}
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {popularSearches.map((item) => (
              <button key={item.query} type="button" onClick={() => goToSearch(item.query)} className="hero-search-chip">
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
