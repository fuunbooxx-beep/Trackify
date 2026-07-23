"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, Loader2, RefreshCw, Save, SearchCheck, ShieldAlert } from "lucide-react";

type CheckResult = "safe" | "scam" | "insufficient";

type CheckRequest = {
  id: string;
  userEmail?: string;
  userName?: string;
  pageName?: string;
  pageLink?: string;
  phone?: string;
  customerNote?: string;
  status?: string;
  result?: CheckResult | "";
  adminComment?: string;
  linkedTargetId?: string;
  createdAt?: number;
  reviewedAt?: number;
};

type ReviewDraft = {
  result: CheckResult;
  adminComment: string;
  linkedTargetId: string;
};

export function AdminCheckRequests({ lang }: { lang: "ar" | "en" }) {
  const [requests, setRequests] = useState<CheckRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/check-requests", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { requests?: CheckRequest[] };
      if (!response.ok) throw new Error("check_requests_load_failed");
      const data = body.requests || [];
      setRequests(data);
      setDrafts(
        Object.fromEntries(
          data.map((item) => [
            item.id,
            {
              result: item.result || "insufficient",
              adminComment: item.adminComment || "",
              linkedTargetId: item.linkedTargetId || "",
            },
          ])
        )
      );
    } catch (error) {
      console.error(error);
      setMessage(lang === "ar" ? "تعذر تحميل طلبات الفحص." : "Could not load check requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRequests = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return requests;
    return requests.filter((item) =>
      [item.pageName, item.pageLink, item.phone, item.userEmail, item.userName, item.customerNote]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(normalized)
    );
  }, [requests, search]);

  const pendingCount = requests.filter((item) => item.status === "pending").length;

  const reviewRequest = async (requestId: string) => {
    const draft = drafts[requestId];
    if (!draft || draft.adminComment.trim().length < 3) {
      setMessage(lang === "ar" ? "اكتب تعليقًا مختصرًا للعميل قبل حفظ النتيجة." : "Add a short customer note before saving.");
      return;
    }

    setSavingId(requestId);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/check-requests/${encodeURIComponent(requestId)}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "review_failed");
      setMessage(lang === "ar" ? "تم حفظ النتيجة وإرسال إشعار للعميل." : "Result saved and the customer was notified.");
      await loadRequests();
    } catch (error) {
      console.error(error);
      setMessage(lang === "ar" ? "تعذر حفظ نتيجة الفحص." : "Could not save the review result.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="glass-panel rounded-3xl p-5 md:p-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black">Check it for me</h2>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-black text-primary">
              {pendingCount} {lang === "ar" ? "قيد المراجعة" : "pending"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {lang === "ar"
              ? "راجع بيانات الصفحة، اختر النتيجة، واكتب تعليقًا مختصرًا يظهر للعميل في بروفايله."
              : "Review the page details, choose a result, and add the note shown in the customer profile."}
          </p>
        </div>
        <button type="button" onClick={() => void loadRequests()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold hover:bg-secondary disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {lang === "ar" ? "تحديث" : "Refresh"}
        </button>
      </div>

      <div className="relative mb-5">
        <SearchCheck className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="input ps-11" placeholder={lang === "ar" ? "بحث بالاسم أو الرابط أو الرقم أو الإيميل..." : "Search by name, link, phone, or email..."} />
      </div>

      {message && <div className="mb-5 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-bold">{message}</div>}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {lang === "ar" ? "جاري تحميل الطلبات..." : "Loading requests..."}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {lang === "ar" ? "لا توجد طلبات فحص حاليًا." : "No check requests right now."}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((item) => {
            const isPending = item.status === "pending";
            const draft = drafts[item.id] || { result: "insufficient", adminComment: "", linkedTargetId: "" };
            return (
              <article key={item.id} className={`rounded-2xl border p-4 md:p-5 ${isPending ? "border-primary/30 bg-primary/[.04]" : "border-border bg-background/60"}`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${isPending ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>
                        {isPending ? <Clock3 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {isPending ? (lang === "ar" ? "قيد المراجعة" : "Pending") : (lang === "ar" ? "تمت المراجعة" : "Reviewed")}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : ""}
                      </span>
                    </div>
                    <h3 className="mt-3 break-words text-xl font-black">{item.pageName || item.pageLink || item.phone || "-"}</h3>
                    <div className="mt-3 grid gap-2 text-sm">
                      {item.pageLink && <a href={item.pageLink} target="_blank" rel="noreferrer" dir="ltr" className="inline-flex w-fit max-w-full items-center gap-2 break-all font-semibold text-primary hover:underline"><ExternalLink className="h-4 w-4 shrink-0" />{item.pageLink}</a>}
                      {item.phone && <p dir="ltr" className="font-semibold">{item.phone}</p>}
                      <p className="text-muted-foreground">{item.userName || item.userEmail || "-"}</p>
                      {item.customerNote && <p className="rounded-xl bg-secondary/60 p-3 leading-6">{item.customerNote}</p>}
                    </div>
                  </div>

                  <div className="w-full space-y-3 xl:max-w-md">
                    {isPending ? (
                      <>
                        <select
                          value={draft.result}
                          onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, result: event.target.value as CheckResult } }))}
                          className="input"
                        >
                          <option value="safe">{lang === "ar" ? "يبدو آمنًا" : "Appears safe"}</option>
                          <option value="scam">{lang === "ar" ? "خطر / نصاب" : "High risk / scam"}</option>
                          <option value="insufficient">{lang === "ar" ? "البيانات غير كافية" : "Insufficient evidence"}</option>
                        </select>
                        <textarea
                          value={draft.adminComment}
                          onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, adminComment: event.target.value } }))}
                          className="input min-h-24"
                          maxLength={800}
                          placeholder={lang === "ar" ? "اكتب تعليق المراجعة الذي سيظهر للعميل..." : "Write the review note shown to the customer..."}
                        />
                        <input
                          value={draft.linkedTargetId}
                          onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, linkedTargetId: event.target.value } }))}
                          className="input"
                          placeholder={lang === "ar" ? "Target ID لو تمت إضافة الصفحة (اختياري)" : "Target ID if the page was added (optional)"}
                          dir="ltr"
                        />
                        <button type="button" onClick={() => void reviewRequest(item.id)} disabled={savingId === item.id} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground hover:bg-primary/90 disabled:opacity-60 dark:bg-neon-blue dark:text-black">
                          {savingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          {lang === "ar" ? "حفظ وإرسال النتيجة" : "Save and send result"}
                        </button>
                      </>
                    ) : (
                      <div className={`rounded-2xl border p-4 ${item.result === "safe" ? "border-emerald-500/30 bg-emerald-500/10" : item.result === "scam" ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                        <p className="flex items-center gap-2 font-black">
                          {item.result === "scam" ? <ShieldAlert className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4" />}
                          {item.result === "safe"
                            ? (lang === "ar" ? "يبدو آمنًا" : "Appears safe")
                            : item.result === "scam"
                              ? (lang === "ar" ? "خطر / نصاب" : "High risk / scam")
                              : (lang === "ar" ? "البيانات غير كافية" : "Insufficient evidence")}
                        </p>
                        <p className="mt-2 text-sm leading-6">{item.adminComment}</p>
                        {item.linkedTargetId && <Link href={`/target/${item.linkedTargetId}`} className="mt-3 inline-flex items-center gap-1 text-sm font-black underline">{lang === "ar" ? "فتح صفحة الهدف" : "Open target page"}<ExternalLink className="h-3.5 w-3.5" /></Link>}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
