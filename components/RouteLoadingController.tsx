"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const LOADING_CLASS = "is-page-loading";
const HARD_NAVIGATION_DELAY_MS = 80;

export function showRouteLoader() {
  document.documentElement.classList.add(LOADING_CLASS);
}

export function hideRouteLoader() {
  document.documentElement.classList.remove(LOADING_CLASS);
}

export function reloadWithRouteLoader() {
  showRouteLoader();
  window.setTimeout(() => window.location.reload(), HARD_NAVIGATION_DELAY_MS);
}

export function assignWithRouteLoader(href: string) {
  showRouteLoader();
  window.setTimeout(() => window.location.assign(href), HARD_NAVIGATION_DELAY_MS);
}

export function RouteLoadingController() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    hideRouteLoader();
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const handlePageShow = () => {
      hideRouteLoader();
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
