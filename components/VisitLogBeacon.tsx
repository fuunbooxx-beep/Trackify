"use client";

import { usePathname } from "next/navigation";
import { useContext, useEffect, useRef } from "react";
import { AuthContext } from "@/lib/providers";
import { db } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";

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
        const ipRes = await fetch("/api/client-ip", { cache: "no-store" });
        const ipBody = (await ipRes.json().catch(() => ({}))) as { ip?: string | null };
        const clientIp = typeof ipBody.ip === "string" && ipBody.ip.trim() ? ipBody.ip.trim().slice(0, 64) : null;

        await addDoc(collection(db, "visitorLogs"), {
          path: pathname.slice(0, 512),
          email: user?.email?.trim().slice(0, 320) || null,
          userId: user?.uid?.trim().slice(0, 128) || null,
          clientIp,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : null,
          createdAt: Date.now(),
        });
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[VisitLogBeacon]", e);
        }
      }
    })();
  }, [pathname, user?.email, user?.uid]);

  return null;
}
