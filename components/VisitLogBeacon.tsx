"use client";

import { usePathname } from "next/navigation";
import { useContext, useEffect, useRef } from "react";
import { AuthContext } from "@/lib/providers";

/** Logs page views from the browser (path, IP from edge, optional email) — avoids Firestore Node gRPC failures. */
export function VisitLogBeacon() {
  const pathname = usePathname();
  const { user } = useContext(AuthContext);
  const last = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) return;
    const now = Date.now();
    if (last.current && last.current.path === pathname && now - last.current.at < 15_000) return;
    last.current = { path: pathname, at: now };

    void (async () => {
      try {
        await fetch("/api/visitor-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          path: pathname.slice(0, 512),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : null,
        }) });
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[VisitLogBeacon]", e);
        }
      }
    })();
  }, [pathname, user?.email, user?.uid]);

  return null;
}
