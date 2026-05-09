"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const BASE_TITLE = "Trackify";
const HOME_TITLE = "Trust Check";

function toTitleCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RouteTitle() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/") {
      document.title = `${BASE_TITLE} | ${HOME_TITLE}`;
      return;
    }

    const parts = pathname.split("/").filter(Boolean);
    const lastSegment = decodeURIComponent(parts[parts.length - 1] || "");
    const pageTitle = toTitleCase(lastSegment) || HOME_TITLE;

    document.title = `${BASE_TITLE} | ${pageTitle}`;
  }, [pathname]);

  return null;
}
