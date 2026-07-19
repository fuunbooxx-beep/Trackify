"use client";

import { Navbar } from "@/components/Navbar";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "@/lib/providers";
import { isAdminUser } from "@/lib/auth-user";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  BadgeInfo,
  CheckCircle2,
  Eye,
  Facebook,
  Globe2,
  Instagram,
  LayoutDashboard,
  Link as LinkIcon,
  ListChecks,
  Loader2,
  Image as ImageIcon,
  Pencil,
  Phone,
  Plus,
  PlusCircle,
  Save,
  Send,
  ShieldBan,
  Trash2,
  UploadCloud,
  Users,
  Youtube,
} from "lucide-react";
import {
  detectPlatform,
  generateSearchTerms,
  getRiskStatusFromReportCount,
  getTargetCategoryLabel,
  getTargetHref,
  getTargetAliases,
  getTargetKnownAliases,
  getTargetLinkedIdentities,
  getTargetPreviousNames,
  getTargetInstapays,
  getTargetLinks,
  getTargetPhones,
  getTargetReasons,
  identityFieldsAfterReportSubmitted,
  hostFromUrl,
  platformLabel,
  TARGET_REASON_OPTIONS,
  TARGET_CATEGORY_OPTIONS,
  targetPayload,
  type TargetLink,
  type TargetRecord,
} from "@/lib/target-utils";
import {
  detectExistingTargetMatch,
  isAuthoritativeTargetMatch,
  type TargetMatchResult,
} from "@/lib/target-linking";
import { mergeDuplicateTargetIntoCanonical } from "@/lib/merge-targets";
import { findSharedPhoneClusters } from "@/lib/phone-patterns";
import { classifyEvidenceTier } from "@/lib/evidence-classify";
import { syncTargetStats } from "@/lib/trust-score";
import { useLanguage } from "@/lib/i18n/context";
import { clientIpToBlockedDocId } from "@/lib/ip-block";

const STATUS_OPTIONS = [
  { value: "warning", labelEn: "Warning", labelAr: "تحذير" },
  { value: "severe_warning", labelEn: "Severe warning", labelAr: "تحذير شديد" },
  { value: "trusted", labelEn: "Trusted", labelAr: "موثوق" },
  { value: "high_risk", labelEn: "High risk", labelAr: "عالي الخطورة" },
  { value: "reviewing", labelEn: "Under review", labelAr: "قيد المراجعة" },
];

const PLATFORM_OPTIONS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "website", label: "Website" },
];

const INSTAPAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/2/20/InstaPay_Logo.png";

const emptyLink: TargetLink = { platform: "facebook", url: "" };

async function patchReportOnServer(reportId: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("report_update_failed");
}

async function deleteReportOnServer(reportId: string) {
  const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("report_delete_failed");
}

async function saveTargetOnServer(targetId: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/admin/targets/${encodeURIComponent(targetId)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("target_save_failed");
}

async function deleteTargetOnServer(targetId: string) {
  const response = await fetch(`/api/admin/targets/${encodeURIComponent(targetId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("target_delete_failed");
}

async function setBlockedIpOnServer(id: string, ip: string, method: "PUT" | "DELETE") {
  const response = await fetch(`/api/admin/blocked-ips/${encodeURIComponent(id)}`, {
    method, headers: { "Content-Type": "application/json" }, body: method === "PUT" ? JSON.stringify({ ip }) : undefined,
  });
  if (!response.ok) throw new Error("blocked_ip_update_failed");
}

async function createAdminReportOnServer(payload: Record<string, unknown>) {
  const response = await fetch("/api/reports/create", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, adminDirect: true }),
  });
  if (!response.ok) throw new Error("report_create_failed");
}

export default function DashboardPage() {
  const { lang } = useLanguage();
  const { user, loading } = useContext(AuthContext);
  const isAdmin = isAdminUser(user);
  const router = useRouter();

  const [targetId, setTargetId] = useState("");
  const [createdAt, setCreatedAt] = useState<number | undefined>();
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState<string[]>([""]);
  const [previousNames, setPreviousNames] = useState<string[]>([""]);
  const [linkedIdentities, setLinkedIdentities] = useState<string[]>([""]);
  const [type, setType] = useState("page");
  const [category, setCategory] = useState("gaming");
  const [phones, setPhones] = useState<string[]>([""]);
  const [instapays, setInstapays] = useState<string[]>([""]);
  const [links, setLinks] = useState<TargetLink[]>([{ ...emptyLink }]);
  const [logoUrl, setLogoUrl] = useState("");
  const [status, setStatus] = useState("reviewing");
  const [trustScore, setTrustScore] = useState(50);
  const [reportCount, setReportCount] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [claimedByUserId, setClaimedByUserId] = useState("");
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingTarget, setDeletingTarget] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [approvedReports, setApprovedReports] = useState<any[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [reportAdminDrafts, setReportAdminDrafts] = useState<
    Record<string, { adminComment: string; adminVerified: boolean; adminPinned: boolean }>
  >({});
  const [approvedDrafts, setApprovedDrafts] = useState<
    Record<string, { adminComment: string; adminVerified: boolean; adminPinned: boolean }>
  >({});
  const [savingApprovedId, setSavingApprovedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualTargetName, setManualTargetName] = useState("");
  const [manualTargetPhone, setManualTargetPhone] = useState("");
  const [manualTargetLink, setManualTargetLink] = useState("");
  const [manualCategory, setManualCategory] = useState("scam");
  const [manualDescription, setManualDescription] = useState("");
  const [manualFiles, setManualFiles] = useState<File[]>([]);
  const [manualImagePreviews, setManualImagePreviews] = useState<string[]>([]);
  const [manualSaving, setManualSaving] = useState(false);
  const manualFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [mergeCanonicalInput, setMergeCanonicalInput] = useState("");
  const [mergeDuplicateInput, setMergeDuplicateInput] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetCategoryFilter, setTargetCategoryFilter] = useState("all");

  type DashboardTab = "targets" | "pending" | "visitors" | "all-reports";
  const searchParams = useSearchParams();
  const activeTab = useMemo<DashboardTab>(() => {
    const t = searchParams.get("tab");
    if (t === "pending" || t === "visitors" || t === "all-reports") return t;
    return "targets";
  }, [searchParams]);

  const [visitorLogs, setVisitorLogs] = useState<any[]>([]);
  const [visitorLogsLoading, setVisitorLogsLoading] = useState(false);
  const [blockedIpRows, setBlockedIpRows] = useState<{ id: string; ip?: string; createdAt?: number }[]>([]);
  const [blockingIpBusy, setBlockingIpBusy] = useState<string | null>(null);

  const [allSiteReports, setAllSiteReports] = useState<any[]>([]);
  const [allReportsLoading, setAllReportsLoading] = useState(false);
  const [allReportsSearch, setAllReportsSearch] = useState("");
  const [allReportEdits, setAllReportEdits] = useState<
    Record<string, { description: string; reporterName: string; targetName: string; category: string; status: string }>
  >({});
  const [savingAllReportId, setSavingAllReportId] = useState<string | null>(null);
  const [deletingAllReportId, setDeletingAllReportId] = useState<string | null>(null);

  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingBodyDrafts, setPendingBodyDrafts] = useState<
    Record<string, { description: string; reporterName: string; targetName: string }>
  >({});
  const [savingPendingBodyId, setSavingPendingBodyId] = useState<string | null>(null);
  const [deletingPendingId, setDeletingPendingId] = useState<string | null>(null);

  const navigateTab = (tab: DashboardTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "targets") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
  };

  const targetNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of targets) {
      if (t.id) map[t.id] = String(t.name || t.id);
    }
    return map;
  }, [targets]);

  const filteredPendingReports = useMemo(() => {
    const q = pendingSearch.trim().toLowerCase();
    if (!q) return pendingReports;
    return pendingReports.filter((r: any) => {
      const hay = [r.targetName, r.reporterName, r.authorEmail, r.description, r.category]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [pendingReports, pendingSearch]);

  const filteredAllReports = useMemo(() => {
    const q = allReportsSearch.trim().toLowerCase();
    if (!q) return allSiteReports;
    return allSiteReports.filter((r: any) => {
      const pageName = targetNameById[String(r.targetId || "")] || r.targetName || "";
      const hay = [r.id, r.targetName, pageName, r.reporterName, r.authorEmail, r.description, r.status, r.category]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [allSiteReports, allReportsSearch, targetNameById]);
  const visitorStats = useMemo(() => {
    const uniqueVisitors = new Set(visitorLogs.map((row) => String(row.userId || row.clientIp || row.id))).size;
    const signedIn = new Set(visitorLogs.filter((row) => row.userId).map((row) => String(row.userId))).size;
    const cities = new Set(visitorLogs.map((row) => String(row.city || "")).filter(Boolean)).size;
    return { uniqueVisitors, signedIn, guests: Math.max(0, uniqueVisitors - signedIn), cities };
  }, [visitorLogs]);
  const cleanPhones = useMemo(() => phones.map((phone) => phone.trim()).filter(Boolean), [phones]);
  const cleanLinks = useMemo(
    () => links.map((link) => ({ ...link, url: link.url.trim() })).filter((link) => link.url),
    [links]
  );
  const cleanIdentityTags = useMemo(
    () => [...aliases, ...previousNames, ...linkedIdentities].map((s) => s.trim()).filter(Boolean),
    [aliases, previousNames, linkedIdentities]
  );
  const previewTerms = useMemo(
    () => generateSearchTerms(name, cleanPhones, cleanLinks, cleanIdentityTags),
    [name, cleanPhones, cleanLinks, cleanIdentityTags]
  );
  const isEditing = Boolean(targetId);
  const sharedPhoneClusters = useMemo(() => findSharedPhoneClusters(targets), [targets]);
  const filteredTargets = useMemo(() => {
    const query = targetSearch.trim().toLowerCase();
    return targets.filter((target) => {
      const matchesCategory = targetCategoryFilter === "all" || String(target.category || "gaming") === targetCategoryFilter;
      if (!matchesCategory) return false;
      if (!query) return true;
      const nameValue = String(target.name || "").toLowerCase();
      const idValue = String(target.id || "").toLowerCase();
      const aliasesValue = getTargetAliases(target).join(" ").toLowerCase();
      const phonesValue = getTargetPhones(target).join(" ");
      const instapayValue = getTargetInstapays(target).join(" ").toLowerCase();
      return (
        nameValue.includes(query) ||
        idValue.includes(query) ||
        aliasesValue.includes(query) ||
        phonesValue.includes(query) ||
        instapayValue.includes(query)
      );
    });
  }, [targets, targetSearch, targetCategoryFilter]);

  const pendingMatchMap = useMemo(() => {
    const map: Record<string, TargetMatchResult> = {};
    for (const report of pendingReports) {
      map[report.id] = detectExistingTargetMatch(report, targets);
    }
    return map;
  }, [pendingReports, targets]);

  const resetForm = () => {
    setTargetId("");
    setCreatedAt(undefined);
    setName("");
    setAliases([""]);
    setPreviousNames([""]);
    setLinkedIdentities([""]);
    setType("page");
    setCategory("gaming");
    setPhones([""]);
    setInstapays([""]);
    setLinks([{ ...emptyLink }]);
    setLogoUrl("");
    setStatus("reviewing");
    setTrustScore(50);
    setReportCount(0);
    setReasons([]);
    setClaimedByUserId("");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const applyTarget = (id: string, target: TargetRecord) => {
    const normalizedPhones = getTargetPhones(target);
    const normalizedInstapays = getTargetInstapays(target);
    const normalizedLinks = getTargetLinks(target);
    setTargetId(id);
    setCreatedAt(target.createdAt);
    setName(target.name || "");
    setAliases(getTargetKnownAliases(target).length ? getTargetKnownAliases(target) : [""]);
    setPreviousNames(getTargetPreviousNames(target).length ? getTargetPreviousNames(target) : [""]);
    setLinkedIdentities(getTargetLinkedIdentities(target).length ? getTargetLinkedIdentities(target) : [""]);
    setType(target.type || "page");
    setCategory(String(target.category || "gaming"));
    setPhones(normalizedPhones.length ? normalizedPhones : [""]);
    setInstapays(normalizedInstapays.length ? normalizedInstapays : [""]);
    setLinks(normalizedLinks.length ? normalizedLinks : [{ ...emptyLink }]);
    setLogoUrl(target.logoUrl || "");
    setStatus(target.status || "reviewing");
    setTrustScore(Number(target.trustScore ?? 50));
    setReportCount(Number(target.reportCount ?? 0));
    setReasons(getTargetReasons(target));
    setClaimedByUserId(target.claimedByUserId || "");
    setSuccessMsg("");
    setErrorMsg("");
  };

  const fetchTargets = async () => {
    setListLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "targets"));
      const data = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as TargetRecord))
        .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
      setTargets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setListLoading(false);
    }
  };

  const fetchPendingReports = async () => {
    setReportsLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "reports"), where("status", "==", "pending")));
      const data: any[] = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setPendingReports(data);
      const drafts: Record<string, { adminComment: string; adminVerified: boolean; adminPinned: boolean }> = {};
      for (const report of data) {
        drafts[report.id] = {
          adminComment: String(report.adminComment || ""),
          adminVerified: Boolean(report.adminVerified),
          adminPinned: Boolean(report.adminPinned),
        };
      }
      setReportAdminDrafts(drafts);
      const bodyDrafts: Record<string, { description: string; reporterName: string; targetName: string }> = {};
      for (const report of data) {
        bodyDrafts[report.id] = {
          description: String(report.description || ""),
          reporterName: String(report.reporterName || ""),
          targetName: String(report.targetName || ""),
        };
      }
      setPendingBodyDrafts(bodyDrafts);
    } catch (error) {
      console.error(error);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchApprovedReportsForTarget = async (id: string) => {
    if (!id) {
      setApprovedReports([]);
      setApprovedDrafts({});
      return;
    }
    setApprovedLoading(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, "reports"), where("targetId", "==", id), where("status", "==", "approved"))
      );
      const data: any[] = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setApprovedReports(data);
      const drafts: Record<string, { adminComment: string; adminVerified: boolean; adminPinned: boolean }> = {};
      for (const report of data) {
        drafts[report.id] = {
          adminComment: String(report.adminComment || ""),
          adminVerified: Boolean(report.adminVerified),
          adminPinned: Boolean(report.adminPinned),
        };
      }
      setApprovedDrafts(drafts);
    } catch (error) {
      console.error(error);
    } finally {
      setApprovedLoading(false);
    }
  };

  const loadTarget = async (id: string) => {
    if (!id.trim()) return;
    setLoadingTarget(true);
    setErrorMsg("");
    try {
      const snap = await getDoc(doc(db, "targets", id.trim()));
      if (!snap.exists()) {
        setErrorMsg(lang === "ar" ? "الـ target ده مش موجود." : "Target does not exist.");
        return;
      }
      applyTarget(snap.id, snap.data() as TargetRecord);
      const next = new URLSearchParams(searchParams.toString());
      next.set("edit", snap.id);
      router.push(`/dashboard?${next.toString()}`);
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "حصل خطأ أثناء تحميل بيانات الـ target." : "Failed to load target data.");
    } finally {
      setLoadingTarget(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void fetchTargets();
    void fetchPendingReports();
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (editId) void loadTarget(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !targetId) return;
    void fetchApprovedReportsForTarget(targetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, targetId]);

  const fetchVisitorData = async () => {
    setVisitorLogsLoading(true);
    try {
      const response = await fetch("/api/visitor-logs", { cache: "no-store" });
      const payload = (await response.json()) as { logs?: any[]; blocked?: Array<{ id: string; ip?: string; createdAt?: number }> };
      if (!response.ok) throw new Error("visitor_logs_failed");
      setVisitorLogs(payload.logs || []);
      const blocked = (payload.blocked || [])
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setBlockedIpRows(blocked as { id: string; ip?: string; createdAt?: number }[]);
    } catch (error) {
      console.error(error);
    } finally {
      setVisitorLogsLoading(false);
    }
  };

  const fetchAllSiteReports = async () => {
    setAllReportsLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "reports"), limit(800)));
      const data: any[] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setAllSiteReports(data);
      const edits: Record<string, { description: string; reporterName: string; targetName: string; category: string; status: string }> = {};
      for (const report of data) {
        edits[report.id] = {
          description: String(report.description || ""),
          reporterName: String(report.reporterName || ""),
          targetName: String(report.targetName || ""),
          category: String(report.category || "scam"),
          status: String(report.status || "pending"),
        };
      }
      setAllReportEdits(edits);
    } catch (error) {
      console.error(error);
    } finally {
      setAllReportsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "visitors") void fetchVisitorData();
    if (activeTab === "all-reports") void fetchAllSiteReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab]);

  const savePendingReportBody = async (reportId: string) => {
    const draft = pendingBodyDrafts[reportId];
    if (!draft) return;
    setSavingPendingBodyId(reportId);
    setErrorMsg("");
    try {
      await patchReportOnServer(reportId, {
        description: draft.description.trim(),
        reporterName: draft.reporterName.trim(),
        targetName: draft.targetName.trim(),
        updatedAt: Date.now(),
      });
      setSuccessMsg(lang === "ar" ? "تم حفظ تعديلات البلاغ." : "Report edits saved.");
      await fetchPendingReports();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر حفظ تعديلات البلاغ." : "Failed to save report edits.");
    } finally {
      setSavingPendingBodyId(null);
    }
  };

  const deletePendingReportDoc = async (reportId: string) => {
    const ok = window.confirm(lang === "ar" ? "حذف هذا البلاغ نهائياً؟" : "Permanently delete this report?");
    if (!ok) return;
    setDeletingPendingId(reportId);
    setErrorMsg("");
    try {
      await deleteReportOnServer(reportId);
      setSuccessMsg(lang === "ar" ? "تم حذف البلاغ." : "Report deleted.");
      await fetchPendingReports();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر حذف البلاغ." : "Failed to delete report.");
    } finally {
      setDeletingPendingId(null);
    }
  };

  const saveAllReportRow = async (reportId: string) => {
    const draft = allReportEdits[reportId];
    if (!draft) return;
    setSavingAllReportId(reportId);
    setErrorMsg("");
    try {
      await patchReportOnServer(reportId, {
        description: draft.description.trim(),
        reporterName: draft.reporterName.trim(),
        targetName: draft.targetName.trim(),
        category: draft.category,
        status: draft.status,
        updatedAt: Date.now(),
      });
      setSuccessMsg(lang === "ar" ? "تم حفظ البلاغ." : "Report saved.");
      await fetchAllSiteReports();
      if (targetId) await fetchApprovedReportsForTarget(targetId);
      await fetchPendingReports();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر حفظ البلاغ." : "Failed to save report.");
    } finally {
      setSavingAllReportId(null);
    }
  };

  const deleteAllReportRow = async (reportId: string) => {
    const ok = window.confirm(lang === "ar" ? "حذف هذا البلاغ نهائياً؟" : "Permanently delete this report?");
    if (!ok) return;
    setDeletingAllReportId(reportId);
    setErrorMsg("");
    try {
      await deleteReportOnServer(reportId);
      setSuccessMsg(lang === "ar" ? "تم حذف البلاغ." : "Report deleted.");
      await fetchAllSiteReports();
      if (targetId) await fetchApprovedReportsForTarget(targetId);
      await fetchPendingReports();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر حذف البلاغ." : "Failed to delete report.");
    } finally {
      setDeletingAllReportId(null);
    }
  };

  const blockVisitorIp = async (ip: string) => {
    const trimmed = ip.trim();
    if (!trimmed) {
      setErrorMsg(lang === "ar" ? "لا يوجد IP صالح لهذا الصف." : "No valid IP for this entry.");
      return;
    }
    const docId = clientIpToBlockedDocId(trimmed);
    setBlockingIpBusy(trimmed);
    setErrorMsg("");
    try {
      await setBlockedIpOnServer(docId, trimmed, "PUT");
      setSuccessMsg(lang === "ar" ? "تم حظر عنوان الـ IP." : "IP address blocked.");
      await fetchVisitorData();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر حظر الـ IP." : "Failed to block IP.");
    } finally {
      setBlockingIpBusy(null);
    }
  };

  const unblockVisitorIp = async (rowId: string) => {
    setBlockingIpBusy(rowId);
    setErrorMsg("");
    try {
      await setBlockedIpOnServer(rowId, "", "DELETE");
      setSuccessMsg(lang === "ar" ? "تم إلغاء حظر الـ IP." : "IP unblocked.");
      await fetchVisitorData();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر إلغاء الحظر." : "Failed to unblock IP.");
    } finally {
      setBlockingIpBusy(null);
    }
  };

  const approveReport = async (report: any) => {
    try {
      setErrorMsg("");
      const candidateName = String(report.targetName || "").trim();
      if (!candidateName) {
        setErrorMsg(lang === "ar" ? "البلاغ بدون اسم هدف." : "Report is missing target name.");
        return;
      }

      const candidatePool =
        targets.length > 0
          ? targets
          : (await getDocs(collection(db, "targets"))).docs.map(
              (item) => ({ id: item.id, ...item.data() } as TargetRecord)
            );

      const bestMatch = detectExistingTargetMatch(report, candidatePool);
      const resolvedExisting = isAuthoritativeTargetMatch(bestMatch) ? bestMatch.target : undefined;
      const targetId = resolvedExisting?.id || `target_${Date.now()}`;
      const baseData = resolvedExisting;

      const idMerge = identityFieldsAfterReportSubmitted(baseData, candidateName);

      const nextReportCount = Number(baseData?.reportCount ?? 0) + 1;
      const payload = targetPayload({
        name: idMerge.name,
        aliases: idMerge.aliases,
        previousNames: baseData ? getTargetPreviousNames(baseData) : [],
        linkedIdentities: baseData ? getTargetLinkedIdentities(baseData) : [],
        type: String(report.targetType || baseData?.type || "page"),
        category: String(baseData?.category || "gaming"),
        phones: [String(report.targetPhone || ""), ...(baseData ? getTargetPhones(baseData) : [])],
        instapays: baseData ? getTargetInstapays(baseData) : [],
        links: [{ platform: detectPlatform(String(report.targetLink || "")), url: String(report.targetLink || "") }, ...(baseData ? getTargetLinks(baseData) : [])],
        logoUrl: String(baseData?.logoUrl || ""),
        status: getRiskStatusFromReportCount(nextReportCount, String(baseData?.status || "reviewing")),
        trustScore: Number(baseData?.trustScore ?? 45),
        reportCount: nextReportCount,
        reasons: baseData ? getTargetReasons(baseData) : [],
        claimedByUserId: String(baseData?.claimedByUserId || ""),
        createdAt: baseData?.createdAt,
      });

      const evidenceTier = classifyEvidenceTier(
        Array.isArray(report.evidenceImages) ? report.evidenceImages.length : 0,
        String(report.description || "")
      );
      const reviewResponse = await fetch(`/api/admin/reports/${encodeURIComponent(report.id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve", targetId, targetPayload: payload,
          allowUserEdit: report.allowUserEdit === true,
          adminComment: reportAdminDrafts[report.id]?.adminComment || "",
          adminVerified: reportAdminDrafts[report.id]?.adminVerified === true,
          adminPinned: reportAdminDrafts[report.id]?.adminPinned === true,
          evidenceTier,
        }),
      });
      if (!reviewResponse.ok) throw new Error("review_failed");
      setSuccessMsg(lang === "ar" ? "تم اعتماد البلاغ وإضافته للهدف." : "Report approved and linked to target.");
      await fetchPendingReports();
      await fetchTargets();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر اعتماد البلاغ." : "Failed to approve report.");
    }
  };

  const rejectReport = async (report: any) => {
    try {
      setErrorMsg("");
      const reviewResponse = await fetch(`/api/admin/reports/${encodeURIComponent(report.id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (!reviewResponse.ok) throw new Error("review_failed");
      setSuccessMsg(lang === "ar" ? "تم رفض البلاغ." : "Report rejected.");
      await fetchPendingReports();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر رفض البلاغ." : "Failed to reject report.");
    }
  };

  const saveApprovedDisplayOptions = async (reportId: string) => {
    const draft = approvedDrafts[reportId];
    if (!draft) return;
    try {
      setSavingApprovedId(reportId);
      await patchReportOnServer(reportId, {
        adminComment: draft.adminComment,
        adminVerified: draft.adminVerified,
        adminPinned: draft.adminPinned,
        updatedAt: Date.now(),
      });
      await syncTargetStats(db, targetId);
      setSuccessMsg(lang === "ar" ? "تم تحديث خيارات العرض للبلاغ." : "Report display options updated.");
      await fetchApprovedReportsForTarget(targetId);
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر تحديث خيارات العرض." : "Failed to update display options.");
    } finally {
      setSavingApprovedId(null);
    }
  };

  const handleManualFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    const images = selected.filter((file) => file.type.startsWith("image/")).slice(0, 10);
    setManualFiles((prev) => [...prev, ...images].slice(0, 10));
    setManualImagePreviews((prev) => [...prev, ...images.map((file) => URL.createObjectURL(file))].slice(0, 10));
    event.target.value = "";
  };

  const removeManualImage = (index: number) => {
    setManualFiles((prev) => prev.filter((_, i) => i !== index));
    setManualImagePreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const createManualReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!manualTargetName.trim() || !manualDescription.trim()) {
      setErrorMsg(lang === "ar" ? "اكتب اسم الهدف ووصف البلاغ على الأقل." : "Target name and report description are required.");
      return;
    }
    setManualSaving(true);
    setErrorMsg("");
    try {
      const uploadedImageUrls: string[] = [];
      if (manualFiles.length > 0) {
        const uploadForm = new FormData();
        uploadForm.set("ownerKey", user.uid);
        manualFiles.forEach((file) => uploadForm.append("files", file));
        const uploadRes = await fetch("/api/report/upload-evidence", {
          method: "POST",
          body: uploadForm,
        });
        const uploadBody = (await uploadRes.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
          urls?: string[];
        };
        if (!uploadRes.ok) {
          const details = uploadBody.details ? ` (${uploadBody.details})` : "";
          throw new Error(`manual_upload_failed${details}`);
        }
        uploadedImageUrls.push(...(uploadBody.urls || []));
      }

      const reportPayload = {
        targetName: manualTargetName.trim(),
        targetPhone: manualTargetPhone.trim(),
        targetLink: manualTargetLink.trim(),
      };
      const bestMatch = detectExistingTargetMatch(reportPayload, targets);
      const baseData = isAuthoritativeTargetMatch(bestMatch) ? bestMatch.target : undefined;
      const resolvedTargetId = baseData?.id || `target_${Date.now()}`;
      const idMerge = identityFieldsAfterReportSubmitted(baseData, manualTargetName.trim());

      const nextReportCount = Number(baseData?.reportCount ?? 0) + 1;
      const nextTargetPayload = targetPayload({
        name: idMerge.name,
        aliases: idMerge.aliases,
        previousNames: baseData ? getTargetPreviousNames(baseData) : [],
        linkedIdentities: baseData ? getTargetLinkedIdentities(baseData) : [],
        type: String(baseData?.type || "page"),
        category: String(baseData?.category || "gaming"),
        phones: [manualTargetPhone.trim(), ...(baseData ? getTargetPhones(baseData) : [])],
        instapays: baseData ? getTargetInstapays(baseData) : [],
        links: [{ platform: detectPlatform(manualTargetLink.trim()), url: manualTargetLink.trim() }, ...(baseData ? getTargetLinks(baseData) : [])],
        logoUrl: String(baseData?.logoUrl || ""),
        status: getRiskStatusFromReportCount(nextReportCount, String(baseData?.status || "reviewing")),
        trustScore: Number(baseData?.trustScore ?? 45),
        reportCount: nextReportCount,
        reasons: baseData ? getTargetReasons(baseData) : [],
        claimedByUserId: String(baseData?.claimedByUserId || ""),
        createdAt: baseData?.createdAt,
      });
      await saveTargetOnServer(resolvedTargetId, nextTargetPayload);

      const manualEvidenceTier = classifyEvidenceTier(uploadedImageUrls.length, manualDescription.trim());
      await createAdminReportOnServer({
        targetId: resolvedTargetId,
        authorId: user.uid,
        authorEmail: user.email || "",
        reporterName: manualCustomerName.trim() || "Manual Entry",
        source: "admin_manual",
        targetName: manualTargetName.trim(),
        targetPhone: manualTargetPhone.trim(),
        targetLink: manualTargetLink.trim(),
        category: manualCategory,
        description: manualDescription.trim(),
        evidenceImages: uploadedImageUrls,
        evidenceTier: manualEvidenceTier,
        status: "approved",
        allowUserEdit: false,
        editRequestPending: false,
        reviewNote: "",
        createdAt: Date.now(),
        reviewedAt: Date.now(),
      });

      manualImagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setManualCustomerName("");
      setManualTargetName("");
      setManualTargetPhone("");
      setManualTargetLink("");
      setManualCategory("scam");
      setManualDescription("");
      setManualFiles([]);
      setManualImagePreviews([]);
      setSuccessMsg(lang === "ar" ? "تمت إضافة البلاغ اليدوي بنجاح." : "Manual report added successfully.");
      await fetchTargets();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMsg(lang === "ar" ? `فشل إضافة البلاغ اليدوي: ${message}` : `Failed to add manual report: ${message}`);
    } finally {
      setManualSaving(false);
    }
  };

  const handleLogoFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!user) {
      setErrorMsg(lang === "ar" ? "سجّل دخولك أولاً لرفع اللوجو." : "Please sign in first to upload logo.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMsg(lang === "ar" ? "ارفع صورة فقط للوجو." : "Please upload an image file for logo.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg(lang === "ar" ? "حجم اللوجو لازم يكون أقل من 4MB." : "Logo image must be smaller than 4MB.");
      return;
    }

    setLogoUploading(true);
    setErrorMsg("");
    try {
      const uploadForm = new FormData();
      uploadForm.set("ownerKey", `${user.uid}_target_logo`);
      uploadForm.append("files", file);
      const uploadRes = await fetch("/api/report/upload-evidence", {
        method: "POST",
        body: uploadForm,
      });
      const uploadBody = (await uploadRes.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
        urls?: string[];
      };
      if (!uploadRes.ok) {
        const details = uploadBody.details ? ` (${uploadBody.details})` : "";
        throw new Error(`logo_upload_failed${details}`);
      }
      const firstUrl = uploadBody.urls?.[0];
      if (!firstUrl) throw new Error("Failed to resolve uploaded logo URL");
      setLogoUrl(firstUrl);
      setSuccessMsg(lang === "ar" ? "تم رفع اللوجو بنجاح." : "Logo uploaded successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/logo_upload_failed|manual_upload_failed|cloudinary_not_configured|upload_failed/i.test(message)) {
        setErrorMsg(
          lang === "ar"
            ? "فشل رفع الصورة. تأكد من إعدادات Cloudinary في السيرفر."
            : "Image upload failed. Please verify Cloudinary server configuration."
        );
      } else {
        setErrorMsg(lang === "ar" ? `فشل رفع اللوجو: ${message}` : `Failed to upload logo: ${message}`);
      }
    } finally {
      setLogoUploading(false);
    }
  };

  const updatePhone = (index: number, value: string) => {
    setPhones((current) => current.map((phone, i) => (i === index ? value : phone)));
  };

  const updateInstapay = (index: number, value: string) => {
    setInstapays((current) => current.map((item, i) => (i === index ? value : item)));
  };

  const updateAlias = (index: number, value: string) => {
    setAliases((current) => current.map((alias, i) => (i === index ? value : alias)));
  };

  const updateLink = (index: number, patch: Partial<TargetLink>) => {
    setLinks((current) =>
      current.map((link, i) => {
        if (i !== index) return link;
        const next = { ...link, ...patch };
        if (patch.url && !patch.platform) next.platform = detectPlatform(patch.url);
        return next;
      })
    );
  };

  const removePhone = (index: number) => {
    setPhones((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));
  };

  const removeInstapay = (index: number) => {
    setInstapays((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));
  };

  const removeAlias = (index: number) => {
    setAliases((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));
  };

  const updatePreviousName = (index: number, value: string) => {
    setPreviousNames((current) => current.map((item, i) => (i === index ? value : item)));
  };

  const removePreviousName = (index: number) => {
    setPreviousNames((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));
  };

  const updateLinkedIdentity = (index: number, value: string) => {
    setLinkedIdentities((current) => current.map((item, i) => (i === index ? value : item)));
  };

  const removeLinkedIdentity = (index: number) => {
    setLinkedIdentities((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));
  };

  const removeLink = (index: number) => {
    setLinks((current) => (current.length === 1 ? [{ ...emptyLink }] : current.filter((_, i) => i !== index)));
  };

  const toggleReason = (reason: string) => {
    setReasons((current) =>
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
    );
  };

  const deleteTarget = async () => {
    if (!user || !isAdmin || !targetId) return;

    const confirmed = window.confirm(
      lang === "ar"
        ? "هل أنت متأكد أنك تريد حذف هذا الـ target؟ سيتم حذف بيانات الصفحة من البحث والقوائم، ولن يتم حذف البلاغات المرتبطة بها."
        : "Are you sure you want to delete this target? The page record will be removed from search and lists. Linked reports will not be deleted."
    );
    if (!confirmed) return;

    setDeletingTarget(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await deleteTargetOnServer(targetId);
      const deletedId = targetId;
      resetForm();
      setApprovedReports([]);
      setSuccessMsg(
        lang === "ar"
          ? `تم حذف target ${deletedId} بنجاح.`
          : `Target ${deletedId} deleted successfully.`
      );
      router.push("/dashboard");
      await fetchTargets();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر حذف الـ target. راجع صلاحيات Firestore." : "Failed to delete target. Check Firestore permissions.");
    } finally {
      setDeletingTarget(false);
    }
  };

  const runMergeDuplicates = async () => {
    if (!user) return;
    const canonical = mergeCanonicalInput.trim();
    const duplicate = mergeDuplicateInput.trim();
    if (!canonical || !duplicate || canonical === duplicate) {
      setErrorMsg(lang === "ar" ? "أدخل مُعرّفين صالحين ومختلفين." : "Enter two different valid target ids.");
      return;
    }
    const confirmed = window.confirm(
      lang === "ar"
        ? `سيتم دمج ${duplicate} في ${canonical}. كل البلاغات ستُنقل ولن يُحذف أي بلاغ. متابعة؟`
        : `Merge ${duplicate} → ${canonical}? All reports will be reassigned. Continue?`
    );
    if (!confirmed) return;
    setMergeBusy(true);
    setErrorMsg("");
    try {
      const response = await fetch("/api/admin/maintenance", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "merge", canonicalId: canonical, duplicateId: duplicate }) });
      const result = (await response.json()) as { reportsMoved?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "merge_failed");
      setSuccessMsg(
        lang === "ar"
          ? `تم الدمج: نُقل ${result.reportsMoved} بلاغ إلى ${canonical}.`
          : `Merged: moved ${result.reportsMoved} report(s) into ${canonical}.`
      );
      setMergeDuplicateInput("");
      if (targetId === duplicate) {
        resetForm();
      }
      await fetchTargets();
    } catch (err) {
      console.error(err);
      setErrorMsg(
        lang === "ar"
          ? `فشل الدمج: ${err instanceof Error ? err.message : String(err)}`
          : `Merge failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setMergeBusy(false);
    }
  };

  const syncAllTargetsStats = async () => {
    if (!isAdmin) return;
    setSyncAllBusy(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const response = await fetch("/api/admin/maintenance", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_all" }) });
      const result = (await response.json()) as { count?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "sync_failed");
      const ids = Array.from({ length: Number(result.count || 0) });
      await fetchTargets();
      setSuccessMsg(
        lang === "ar"
          ? `تمت مزامنة الإحصائيات لـ ${ids.length} صفحة.`
          : `Synced stats for ${ids.length} targets.`
      );
    } catch (err) {
      console.error(err);
      setErrorMsg(
        lang === "ar"
          ? `فشل مزامنة الإحصائيات: ${err instanceof Error ? err.message : String(err)}`
          : `Failed syncing stats: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSyncAllBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    if (!name.trim()) {
      setErrorMsg(lang === "ar" ? "لازم تكتب اسم الصفحة أو البائع." : "Page or seller name is required.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const id = targetId || "target_" + Date.now();
      const payload = targetPayload({
        name,
        aliases,
        previousNames,
        linkedIdentities,
        type,
        category,
        phones,
        instapays,
        links,
        logoUrl,
        status: getRiskStatusFromReportCount(reportCount, status),
        trustScore,
        reportCount,
        reasons,
        claimedByUserId,
        createdAt,
      });

      await saveTargetOnServer(id, payload);
      setTargetId(id);
      setCreatedAt(payload.createdAt);
      setSuccessMsg(isEditing ? (lang === "ar" ? "تم تعديل بيانات الصفحة بنجاح." : "Target updated successfully.") : (lang === "ar" ? "تمت إضافة الصفحة بنجاح." : "Target created successfully."));
      const next = new URLSearchParams(searchParams.toString());
      next.set("edit", id);
      router.push(`/dashboard?${next.toString()}`);
      await fetchTargets();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "حصل خطأ أثناء حفظ البيانات في Firestore. راجع قواعد Firestore لو التعديل مرفوض." : "Failed to save data to Firestore. Check security rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-28 min-h-screen">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2">{lang === "ar" ? "لوحة إدارة الصفحات" : "Target management"}</h1>
            <p className="text-muted-foreground font-medium">
              {lang === "ar" ? "أضف أو عدل بيانات الصفحة، الأرقام، اللينكات، واللوجو من مكان واحد." : "Create or edit target data, phone numbers, links, and logo from one place."}
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                navigateTab("targets");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-bold hover:bg-secondary/70"
            >
              <Plus className="w-4 h-4" />
              {lang === "ar" ? "Target جديد" : "New target"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground font-medium">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{lang === "ar" ? "جاري تحميل الحساب..." : "Loading account..."}</span>
          </div>
        ) : !user || !isAdmin ? (
          <UnauthorizedNotFound />
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <nav
              className="glass-panel rounded-3xl p-3 lg:w-52 xl:w-56 shrink-0 lg:sticky lg:top-28 space-y-1"
              aria-label={lang === "ar" ? "أقسام اللوحة" : "Dashboard sections"}
            >
              {(
                [
                  { id: "targets" as const, ar: "الصفحات والأهداف", en: "Pages & targets", icon: LayoutDashboard },
                  { id: "pending" as const, ar: "بلاغات معلّقة وفلترة", en: "Pending & filters", icon: ListChecks },
                  { id: "visitors" as const, ar: "زوار الموقع", en: "Site visitors", icon: Users },
                  { id: "all-reports" as const, ar: "كل البلاغات", en: "All reports", icon: AlertCircle },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTab(item.id)}
                    className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-start text-sm font-bold transition ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm dark:bg-neon-blue dark:text-black"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="leading-snug">{lang === "ar" ? item.ar : item.en}</span>
                  </button>
                );
              })}
            </nav>
            <div className="min-w-0 flex-1 space-y-6">
              {(errorMsg || successMsg) && (
                <div className="space-y-2">
                  {errorMsg ? <AlertBox tone="danger" text={errorMsg} /> : null}
                  {successMsg ? <AlertBox tone="success" text={successMsg} /> : null}
                </div>
              )}
              {activeTab === "targets" && (
                <>
                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
            <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-5 md:p-8 space-y-6">
              <div className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-primary dark:text-neon-blue">{isEditing ? (lang === "ar" ? "وضع التعديل" : "Edit mode") : (lang === "ar" ? "إضافة جديدة" : "Create mode")}</p>
                  <h2 className="text-2xl font-black">{isEditing ? targetId : (lang === "ar" ? "Target جديد" : "New target")}</h2>
                </div>
                {isEditing && (
                  <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(getTargetHref({ id: targetId, name }))}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary"
                  >
                    <Eye className="w-4 h-4" />
                    {lang === "ar" ? "معاينة الصفحة" : "Preview page"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTarget()}
                    disabled={deletingTarget}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive hover:bg-destructive/15 disabled:opacity-60"
                  >
                    {deletingTarget ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {lang === "ar" ? "حذف Target" : "Delete target"}
                  </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={lang === "ar" ? "الاسم *" : "Name *"}>
                  <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Store Online Media" />
                </Field>

                <Field label={lang === "ar" ? "النوع / Badge" : "Type / badge"}>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                    <option value="page">{lang === "ar" ? "Page (صفحة)" : "Page"}</option>
                    <option value="group">{lang === "ar" ? "Group (جروب)" : "Group"}</option>
                    <option value="phone_number">{lang === "ar" ? "Phone number (رقم)" : "Phone number"}</option>
                    <option value="telegram_channel">{lang === "ar" ? "Telegram Channel (قناة تيليجرام)" : "Telegram Channel"}</option>
                  </select>
                </Field>

                <Field label={lang === "ar" ? "تصنيف الصفحة" : "Page category"}>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                    {TARGET_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {lang === "ar" ? option.labelAr : option.labelEn}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={lang === "ar" ? "الحالة" : "Status"}>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {lang === "ar" ? option.labelAr : option.labelEn}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Trust Score (0-100)">
                  <input type="number" min={0} max={100} value={trustScore} onChange={(e) => setTrustScore(Number(e.target.value))} className="input" />
                </Field>

                <Field label={lang === "ar" ? "عدد البلاغات" : "Reports count"}>
                  <input type="number" min={0} value={reportCount} onChange={(e) => setReportCount(Number(e.target.value))} className="input" />
                </Field>

                <Field label={lang === "ar" ? "لوجو اختياري" : "Optional logo"}>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} dir="ltr" className="input" placeholder="https://.../logo.png" />
                      <button
                        type="button"
                        disabled={logoUploading}
                        onClick={() => logoFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-bold hover:bg-secondary/70 disabled:opacity-60"
                      >
                        {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                        <span>{lang === "ar" ? "رفع" : "Upload"}</span>
                      </button>
                    </div>
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileSelected}
                      className="hidden"
                    />
                  </div>
                </Field>

                <Field label={lang === "ar" ? "claimedByUserId (اختياري)" : "claimedByUserId (optional)"}>
                  <input value={claimedByUserId} onChange={(e) => setClaimedByUserId(e.target.value)} className="input" placeholder={lang === "ar" ? "uid لو عايز يظهر كبائع موثق" : "uid to mark this as verified seller"} />
                </Field>
              </div>

              <DynamicSection title={lang === "ar" ? "أرقام الهاتف" : "Phone numbers"} action={lang === "ar" ? "إضافة رقم" : "Add number"} onAdd={() => setPhones((current) => [...current, ""])}>
                {phones.map((phone, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                      <input value={phone} onChange={(e) => updatePhone(index, e.target.value)} dir="ltr" className="input pl-10" placeholder="01012345678" />
                    </div>
                    <IconButton label={lang === "ar" ? "حذف الرقم" : "Delete number"} onClick={() => removePhone(index)}>
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                ))}
              </DynamicSection>

              <DynamicSection title={lang === "ar" ? "Instapay" : "Instapay"} action={lang === "ar" ? "إضافة حساب" : "Add handle"} onAdd={() => setInstapays((current) => [...current, ""])}>
                {instapays.map((instapay, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="relative flex-1">
                      <img
                        src={INSTAPAY_ICON_URL}
                        alt="Instapay"
                        className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 object-contain brightness-0 invert"
                      />
                      <input value={instapay} onChange={(e) => updateInstapay(index, e.target.value)} dir="ltr" className="input pl-10" placeholder="instapay username / wallet" />
                    </div>
                    <IconButton label={lang === "ar" ? "حذف حساب Instapay" : "Delete Instapay"} onClick={() => removeInstapay(index)}>
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                ))}
              </DynamicSection>

              <DynamicSection
                title={lang === "ar" ? "أسماء معروفة (Known aliases)" : "Known aliases"}
                action={lang === "ar" ? "إضافة وسام" : "Add tag"}
                onAdd={() => setAliases((current) => [...current, ""])}
              >
                {aliases.map((alias, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="relative flex-1">
                      <BadgeInfo className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={alias}
                        onChange={(e) => updateAlias(index, e.target.value)}
                        className="input pl-10"
                        placeholder={lang === "ar" ? "مثال: Zero Lag Store" : "e.g. Zero Lag Store"}
                      />
                    </div>
                    <IconButton label={lang === "ar" ? "حذف" : "Remove"} onClick={() => removeAlias(index)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
              </DynamicSection>

              <DynamicSection
                title={lang === "ar" ? "أسماء سابقة (Previous names)" : "Previous names"}
                action={lang === "ar" ? "إضافة وسام" : "Add tag"}
                onAdd={() => setPreviousNames((current) => [...current, ""])}
              >
                {previousNames.map((prevName, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="relative flex-1">
                      <BadgeInfo className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={prevName}
                        onChange={(e) => updatePreviousName(index, e.target.value)}
                        className="input pl-10"
                        placeholder={lang === "ar" ? "مثال: GS Gaming" : "e.g. GS Gaming"}
                      />
                    </div>
                    <IconButton label={lang === "ar" ? "حذف" : "Remove"} onClick={() => removePreviousName(index)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
              </DynamicSection>

              <DynamicSection
                title={lang === "ar" ? "هويات مرتبطة (Linked identities)" : "Linked identities"}
                action={lang === "ar" ? "إضافة وسام" : "Add tag"}
                onAdd={() => setLinkedIdentities((current) => [...current, ""])}
              >
                {linkedIdentities.map((identity, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="relative flex-1">
                      <BadgeInfo className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={identity}
                        onChange={(e) => updateLinkedIdentity(index, e.target.value)}
                        className="input pl-10"
                        placeholder={lang === "ar" ? "مثال: GS PS Hub" : "e.g. GS PS Hub"}
                      />
                    </div>
                    <IconButton label={lang === "ar" ? "حذف" : "Remove"} onClick={() => removeLinkedIdentity(index)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
              </DynamicSection>
              <DynamicSection title={lang === "ar" ? "روابط الصفحات والسوشيال" : "Page and social links"} action={lang === "ar" ? "إضافة لينك" : "Add link"} onAdd={() => setLinks((current) => [...current, { ...emptyLink }])}>
                {links.map((link, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr_auto]">
                    <select value={link.platform} onChange={(e) => updateLink(index, { platform: e.target.value })} className="input">
                      {PLATFORM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <PlatformIcon platform={link.platform} className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                      <input value={link.url} onChange={(e) => updateLink(index, { url: e.target.value })} dir="ltr" className="input pl-10" placeholder="https://facebook.com/..." />
                    </div>
                    <IconButton label={lang === "ar" ? "حذف اللينك" : "Delete link"} onClick={() => removeLink(index)}>
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                ))}
              </DynamicSection>

              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-black uppercase tracking-wide">
                        {lang === "ar" ? "\u0623\u0633\u0628\u0627\u0628 \u0627\u0644\u062a\u062d\u0630\u064a\u0631" : "REASONS"}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {lang === "ar"
                          ? "\u0627\u062e\u062a\u0631 \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u062a\u064a \u0633\u062a\u0638\u0647\u0631 \u0644\u0644\u0639\u0645\u064a\u0644 \u0641\u064a \u0635\u0641\u062d\u0629 \u0627\u0644\u0647\u062f\u0641."
                          : "Pick the warning badges customers will see on the target page."}
                      </p>
                    </div>
                  </div>
                  {reasons.length > 0 && (
                    <span className="w-fit rounded-full bg-background px-3 py-1 text-xs font-black text-amber-700 dark:text-amber-300">
                      {reasons.length} selected
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {TARGET_REASON_OPTIONS.map((option) => {
                    const selected = reasons.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleReason(option.value)}
                        className={`min-h-[92px] rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${
                          selected
                            ? "border-amber-500 bg-amber-500/15 text-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.25)]"
                            : "border-border bg-background/70 text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/10"
                        }`}
                        aria-pressed={selected}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black uppercase tracking-wide">
                            {lang === "ar" ? option.labelAr : option.labelEn}
                          </span>
                          <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-amber-500" : "bg-muted-foreground/30"}`} />
                        </span>
                        <span className="mt-1 block text-xs leading-5">
                          {lang === "ar" ? option.descriptionAr : option.descriptionEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-secondary/40 border border-border p-4">
                <p className="text-sm font-bold mb-2">Preview searchTerms:</p>
                <p className="text-xs text-muted-foreground break-words">
                  {previewTerms.length > 0 ? previewTerms.join(" , ") : (lang === "ar" ? "اكتب اسم/رقم/لينك عشان يتولدوا تلقائيا" : "Enter name/phone/link to generate search terms")}
                </p>
              </div>

              <button
                type="submit"
                disabled={saving || loadingTarget}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-primary dark:bg-neon-blue text-white dark:text-black font-bold px-6 py-3 rounded-xl disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? <Save className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                <span>{saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : isEditing ? (lang === "ar" ? "حفظ التعديل" : "Save changes") : (lang === "ar" ? "إضافة Target" : "Create target")}</span>
              </button>
            </form>

            <aside className="glass-panel rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">{lang === "ar" ? "الصفحات الحالية" : "Existing targets"}</h2>
                {listLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="flex gap-2">
                <input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  dir="ltr"
                  className="input"
                  placeholder="target_1777892300416"
                />
                <button
                  type="button"
                  onClick={() => loadTarget(targetId)}
                  disabled={loadingTarget}
                  className="rounded-xl bg-secondary px-4 font-bold hover:bg-secondary/70 disabled:opacity-60"
                >
                  {loadingTarget ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === "ar" ? "تحميل" : "Load")}
                </button>
              </div>

              <div className="space-y-2">
                <input
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                  className="input"
                  placeholder={lang === "ar" ? "ابحث بالاسم / ID / رقم الهاتف / Instapay" : "Search by name / ID / phone / instapay"}
                />
                <select
                  value={targetCategoryFilter}
                  onChange={(e) => setTargetCategoryFilter(e.target.value)}
                  className="input"
                >
                  <option value="all">{lang === "ar" ? "كل التصنيفات" : "All categories"}</option>
                  {TARGET_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {lang === "ar" ? option.labelAr : option.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {filteredTargets.map((target) => (
                  <div key={target.id} className="rounded-xl border border-border bg-background/50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{target.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
                          {target.id}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary dark:text-neon-blue">
                            {getTargetCategoryLabel(String(target.category || "gaming"), lang)}
                          </span>
                          {getTargetPhones(target).slice(0, 1).map((phone) => (
                            <span key={phone} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground" dir="ltr">
                              {phone}
                            </span>
                          ))}
                          {getTargetLinks(target).slice(0, 1).map((link) => (
                            <span key={link.url} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                              {platformLabel(link.platform)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => target.id && applyTarget(target.id, target)}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold hover:bg-secondary"
                        aria-label={lang === "ar" ? "تعديل" : "Edit"}
                      >
                        {lang === "ar" ? "تعديل" : "Edit"}
                      </button>
                    </div>
                  </div>
                ))}
                {filteredTargets.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {lang === "ar" ? "لا توجد صفحات مطابقة للفلاتر الحالية." : "No targets match the current filters."}
                  </p>
                )}
              </div>
            </aside>
          </div>

          <section className="glass-panel rounded-3xl p-5 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black">
                {lang === "ar" ? "التعليق المثبت والتوثيق (بلاغات موثقة)" : "Pinned note & verification (verified reports)"}
              </h2>
              {approvedLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            {!targetId ? (
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? "حمّل Target أولاً من القائمة الجانبية." : "Load a target first from the sidebar."}
              </p>
            ) : approvedReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? "لا توجد بلاغات موثقة لهذا الهدف بعد." : "No verified reports for this target yet."}
              </p>
            ) : (
              <div className="space-y-4">
                {approvedReports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-border bg-background/60 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm truncate">{report.reporterName || report.authorEmail || report.id}</p>
                      <span className="text-xs text-muted-foreground" dir="ltr">#{report.id}</span>
                    </div>
                    <textarea
                      value={approvedDrafts[report.id]?.adminComment || ""}
                      onChange={(e) =>
                        setApprovedDrafts((prev) => ({
                          ...prev,
                          [report.id]: {
                            adminComment: e.target.value,
                            adminVerified: prev[report.id]?.adminVerified ?? false,
                            adminPinned: prev[report.id]?.adminPinned ?? false,
                          },
                        }))
                      }
                      className="input min-h-[90px]"
                      placeholder={lang === "ar" ? "تعليق الإدارة المثبت..." : "Pinned admin note..."}
                    />
                    <div className="flex flex-wrap gap-3 text-xs">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 bg-background cursor-pointer">
                        <input
                          type="checkbox"
                          checked={approvedDrafts[report.id]?.adminVerified || false}
                          onChange={(e) =>
                            setApprovedDrafts((prev) => ({
                              ...prev,
                              [report.id]: {
                                adminComment: prev[report.id]?.adminComment ?? "",
                                adminVerified: e.target.checked,
                                adminPinned: prev[report.id]?.adminPinned ?? false,
                              },
                            }))
                          }
                        />
                        <span>{lang === "ar" ? "موثق من الإدارة" : "Verified by admin"}</span>
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 bg-background cursor-pointer">
                        <input
                          type="checkbox"
                          checked={approvedDrafts[report.id]?.adminPinned || false}
                          onChange={(e) =>
                            setApprovedDrafts((prev) => ({
                              ...prev,
                              [report.id]: {
                                adminComment: prev[report.id]?.adminComment ?? "",
                                adminVerified: prev[report.id]?.adminVerified ?? false,
                                adminPinned: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>{lang === "ar" ? "تثبيت أولاً" : "Pin first"}</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={savingApprovedId === report.id}
                      onClick={() => void saveApprovedDisplayOptions(report.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
                    >
                      {savingApprovedId === report.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{lang === "ar" ? "حفظ" : "Save"}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-panel rounded-3xl p-5 md:p-8">
            <h2 className="text-2xl font-black mb-4">
              {lang === "ar" ? "إضافة بلاغ يدوي (نيابة عن عميل)" : "Add manual report (on behalf of customer)"}
            </h2>
            <form onSubmit={createManualReport} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={lang === "ar" ? "اسم العميل" : "Customer name"}>
                  <input value={manualCustomerName} onChange={(e) => setManualCustomerName(e.target.value)} className="input" placeholder={lang === "ar" ? "اسم العميل كما قاله" : "Customer name"} />
                </Field>
                <Field label={lang === "ar" ? "اسم الصفحة / البائع *" : "Target name *"}>
                  <input required value={manualTargetName} onChange={(e) => setManualTargetName(e.target.value)} className="input" placeholder="Ferrari station" />
                </Field>
                <Field label={lang === "ar" ? "رقم الهاتف" : "Phone number"}>
                  <input value={manualTargetPhone} onChange={(e) => setManualTargetPhone(e.target.value)} className="input" dir="ltr" placeholder="01012345678" />
                </Field>
                <Field label={lang === "ar" ? "رابط الصفحة" : "Page link"}>
                  <input value={manualTargetLink} onChange={(e) => setManualTargetLink(e.target.value)} className="input" dir="ltr" placeholder="https://facebook.com/..." />
                </Field>
                <Field label={lang === "ar" ? "التصنيف" : "Category"}>
                  <select value={manualCategory} onChange={(e) => setManualCategory(e.target.value)} className="input">
                    <option value="scam">{lang === "ar" ? "نصب / سرقة" : "Scam / theft"}</option>
                    <option value="delay">{lang === "ar" ? "تأخير متعمد" : "Intentional delay"}</option>
                    <option value="bad_treatment">{lang === "ar" ? "سوء تعامل / إساءة" : "Poor treatment / abuse"}</option>
                    <option value="suspicious_untrusted">{lang === "ar" ? "مشبوهة / غير موثوق" : "Suspicious / untrusted"}</option>
                    <option value="successful_transaction">{lang === "ar" ? "تجربة ناجحة" : "Successful transaction"}</option>
                  </select>
                </Field>
              </div>
              <Field label={lang === "ar" ? "وصف البلاغ *" : "Report description *"}>
                <textarea required value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} className="input min-h-[120px]" placeholder={lang === "ar" ? "اكتب تفاصيل الشكوى كاملة..." : "Write full complaint details..."} />
              </Field>

              <div className="space-y-2">
                <p className="text-sm font-bold text-muted-foreground">{lang === "ar" ? "صور الأدلة (حتى 10 صور)" : "Evidence images (up to 10)"}</p>
                <div className="flex flex-wrap gap-2">
                  {manualImagePreviews.map((img, idx) => (
                    <div key={`manual-img-${idx}`} className="relative">
                      <img src={img} alt="Evidence" className="w-20 h-20 rounded-lg border border-border object-cover" />
                      <button type="button" onClick={() => removeManualImage(idx)} className="absolute -top-1 -right-1 rounded-full bg-black/80 text-white text-xs w-5 h-5">
                        x
                      </button>
                    </div>
                  ))}
                  {manualImagePreviews.length < 10 && (
                    <button type="button" onClick={() => manualFileInputRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <input ref={manualFileInputRef} type="file" accept="image/*" multiple onChange={handleManualFilesSelected} className="hidden" />
              </div>

              <button type="submit" disabled={manualSaving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {manualSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                <span>{lang === "ar" ? "إضافة البلاغ اليدوي" : "Add manual report"}</span>
              </button>
            </form>
          </section>

          <section className="glass-panel rounded-3xl p-5 md:p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-black">{lang === "ar" ? "سلامة البيانات والدمج" : "Data integrity & merge"}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "ar"
                  ? "دمج صفحات مكررة بأمان: نقل كل البلاغات ثم إعادة حساب الإحصائيات."
                  : "Safely merge duplicate pages: reassign all reports, then recompute stats."}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={syncAllBusy}
                onClick={() => void syncAllTargetsStats()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {syncAllBusy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}{" "}
                {lang === "ar" ? "Sync الإحصائيات لكل الصفحات" : "Sync stats for all targets"}
              </button>
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? "شغّلها مرة بعد أي تحديثات كبيرة أو ترحيل بيانات."
                  : "Run once after major logic changes or data migration."}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <Field label={lang === "ar" ? "المعرّف الأساسي (يبقى)" : "Canonical target id (kept)"}>
                <input
                  value={mergeCanonicalInput}
                  onChange={(e) => setMergeCanonicalInput(e.target.value)}
                  dir="ltr"
                  className="input"
                  placeholder="target_abc"
                />
              </Field>
              <Field label={lang === "ar" ? "المعرّف المكرر (يُحذف)" : "Duplicate target id (removed)"}>
                <input
                  value={mergeDuplicateInput}
                  onChange={(e) => setMergeDuplicateInput(e.target.value)}
                  dir="ltr"
                  className="input"
                  placeholder="target_xyz"
                />
              </Field>
              <button
                type="button"
                disabled={mergeBusy}
                onClick={() => void runMergeDuplicates()}
                className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {mergeBusy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}{" "}
                {lang === "ar" ? "دمج الآن" : "Merge now"}
              </button>
            </div>
            <div>
              <h3 className="text-lg font-black mb-2">{lang === "ar" ? "أرقام مشتركة بين عدة صفحات" : "Shared phone numbers (suspicious clusters)"}</h3>
              {sharedPhoneClusters.length === 0 ? (
                <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا يوجد تداخل حالياً." : "No overlapping numbers detected."}</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {sharedPhoneClusters.map((c) => (
                    <li key={c.phone} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                      <span className="font-mono font-bold" dir="ltr">
                        {c.phone}
                      </span>
                      <span className="text-muted-foreground"> — {c.count} targets</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.targetIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setMergeCanonicalInput((cur) => cur || id);
                              void loadTarget(id);
                            }}
                            className="rounded bg-secondary px-2 py-0.5 text-xs font-mono"
                            dir="ltr"
                          >
                            {id}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
                </>
              )}

              {activeTab === "pending" && (
                <section className="glass-panel rounded-3xl p-5 md:p-8">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-black">{lang === "ar" ? "بلاغات معلّقة وفلترة" : "Pending reports & filters"}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {lang === "ar" ? "ابحث في الأسماء والنصوص المكتوبة في البلاغ." : "Search reporter names, target names, and report text."}
                      </p>
                    </div>
                    {reportsLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                  </div>
                  <input
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    className="input mb-4 max-w-2xl"
                    placeholder={lang === "ar" ? "بحث في الهدف، المُبلّغ، الإيميل، الوصف..." : "Filter by target, reporter, email, description..."}
                  />
                  <div className="space-y-3">
                    {pendingReports.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد بلاغات معلقة حاليًا." : "No pending reports right now."}</p>
                    ) : filteredPendingReports.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا نتائج مطابقة للبحث." : "No matches for this search."}</p>
                    ) : (
                      filteredPendingReports.map((report) => (
                        <div key={report.id} className="rounded-2xl border border-border bg-background/60 p-5 space-y-4">
                          {(() => {
                            const match = pendingMatchMap[report.id];
                            const willMerge = isAuthoritativeTargetMatch(match);
                            const fuzzyHint = match?.nameFuzzyBest;
                            if (!willMerge && !fuzzyHint) return null;

                            return (
                              <div className="space-y-2">
                                {willMerge ? (
                                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                      {lang === "ar"
                                        ? "سيتم الدمج مع هدف موجود عند الموافقة:"
                                        : "Approval will attach to existing target:"}
                                    </span>{" "}
                                    <span className="font-semibold">{match.target?.name || "-"}</span>
                                    <span className="text-muted-foreground">
                                      {" "}
                                      (
                                      {match.reason === "phone"
                                        ? lang === "ar"
                                          ? "مطابقة رقم الهاتف"
                                          : "Phone match"
                                        : match.reason === "link"
                                          ? lang === "ar"
                                            ? "مطابقة رابط الصفحة"
                                            : "Link match"
                                          : lang === "ar"
                                            ? "مطابقة اسم تامّة أو بديل مسجّل"
                                            : "Exact name match (or saved alias)"}
                                      )
                                    </span>
                                  </div>
                                ) : null}
                                {!willMerge && fuzzyHint ? (
                                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                                    <span className="font-bold text-amber-800 dark:text-amber-300">
                                      {lang === "ar" ? "تشابه اسم فقط (لن يُربط تلقائيًا)" : "Similar name only (not auto-linked)"}:
                                    </span>{" "}
                                    <span className="font-semibold">{fuzzyHint.target.name || "-"}</span>
                                    <span className="text-muted-foreground">
                                      {" "}
                                      (~{Math.round(fuzzyHint.score * 100)}%)
                                      {lang === "ar"
                                        ? " — لو نفس المتجر عدّل اسم البلاغ ليطابق الاسم المعروض، أو أكّد برقم\/رابط واحد قبل الاعتماد."
                                        : " — If it’s the same business, edit the report name to match exactly, or link a matching phone/URL before approving."}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full bg-secondary px-2.5 py-1 font-bold">{lang === "ar" ? "معلّق" : "Pending"}</span>
                                <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">{report.category || "-"}</span>
                                <span className="text-muted-foreground" dir="ltr">#{report.id}</span>
                              </div>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Field label={lang === "ar" ? "اسم الهدف (تعديل)" : "Target name (edit)"}>
                                  <input
                                    value={pendingBodyDrafts[report.id]?.targetName ?? ""}
                                    onChange={(e) =>
                                      setPendingBodyDrafts((prev) => ({
                                        ...prev,
                                        [report.id]: {
                                          description: prev[report.id]?.description ?? "",
                                          reporterName: prev[report.id]?.reporterName ?? "",
                                          targetName: e.target.value,
                                        },
                                      }))
                                    }
                                    className="input"
                                  />
                                </Field>
                                <Field label={lang === "ar" ? "اسم المُبلّغ (تعديل)" : "Reporter name (edit)"}>
                                  <input
                                    value={pendingBodyDrafts[report.id]?.reporterName ?? ""}
                                    onChange={(e) =>
                                      setPendingBodyDrafts((prev) => ({
                                        ...prev,
                                        [report.id]: {
                                          description: prev[report.id]?.description ?? "",
                                          reporterName: e.target.value,
                                          targetName: prev[report.id]?.targetName ?? "",
                                        },
                                      }))
                                    }
                                    className="input"
                                  />
                                </Field>
                              </div>
                              <Field label={lang === "ar" ? "وصف البلاغ (تعديل)" : "Description (edit)"}>
                                <textarea
                                  value={pendingBodyDrafts[report.id]?.description ?? ""}
                                  onChange={(e) =>
                                    setPendingBodyDrafts((prev) => ({
                                      ...prev,
                                      [report.id]: {
                                        description: e.target.value,
                                        reporterName: prev[report.id]?.reporterName ?? "",
                                        targetName: prev[report.id]?.targetName ?? "",
                                      },
                                    }))
                                  }
                                  className="input min-h-[100px]"
                                />
                              </Field>
                              <div className="rounded-xl border border-border bg-background/70 p-3 text-xs space-y-1">
                                <p className="font-bold text-muted-foreground">{lang === "ar" ? "حساب المُبلّغ" : "Submitter account"}</p>
                                <p className="break-all" dir="ltr">{report.authorEmail || report.authorId || "â€”"}</p>
                                <p className="mt-2 font-bold text-muted-foreground">{lang === "ar" ? "رقم مذكور" : "Phone on report"}</p>
                                <p dir="ltr">{report.targetPhone || "â€”"}</p>
                                {report.targetLink ? (
                                  <a href={report.targetLink} target="_blank" rel="noreferrer" className="mt-1 block break-all text-primary underline" dir="ltr">
                                    {report.targetLink}
                                  </a>
                                ) : null}
                              </div>
                              {Array.isArray(report.evidenceImages) && report.evidenceImages.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {report.evidenceImages.map((img: string, idx: number) => (
                                    <a key={`${report.id}-ev-${idx}`} href={img} target="_blank" rel="noreferrer">
                                      <img src={img} alt="" className="h-16 w-16 rounded-lg border object-cover" />
                                    </a>
                                  ))}
                                </div>
                              )}
                              <div className="rounded-xl border border-border bg-background/70 p-3 space-y-2">
                                <p className="text-[11px] font-bold uppercase text-muted-foreground">{lang === "ar" ? "خيارات العرض" : "Display options"}</p>
                                <textarea
                                  value={reportAdminDrafts[report.id]?.adminComment || ""}
                                  onChange={(e) =>
                                    setReportAdminDrafts((prev) => ({
                                      ...prev,
                                      [report.id]: {
                                        adminComment: e.target.value,
                                        adminVerified: prev[report.id]?.adminVerified ?? false,
                                        adminPinned: prev[report.id]?.adminPinned ?? false,
                                      },
                                    }))
                                  }
                                  className="input min-h-[72px]"
                                  placeholder={lang === "ar" ? "تعليق الأدمن..." : "Admin comment..."}
                                />
                                <div className="flex flex-wrap gap-3 text-xs">
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={reportAdminDrafts[report.id]?.adminVerified || false}
                                      onChange={(e) =>
                                        setReportAdminDrafts((prev) => ({
                                          ...prev,
                                          [report.id]: {
                                            adminComment: prev[report.id]?.adminComment ?? "",
                                            adminVerified: e.target.checked,
                                            adminPinned: prev[report.id]?.adminPinned ?? false,
                                          },
                                        }))
                                      }
                                    />
                                    <span>{lang === "ar" ? "توثيق" : "Verified"}</span>
                                  </label>
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={reportAdminDrafts[report.id]?.adminPinned || false}
                                      onChange={(e) =>
                                        setReportAdminDrafts((prev) => ({
                                          ...prev,
                                          [report.id]: {
                                            adminComment: prev[report.id]?.adminComment ?? "",
                                            adminVerified: prev[report.id]?.adminVerified ?? false,
                                            adminPinned: e.target.checked,
                                          },
                                        }))
                                      }
                                    />
                                    <span>{lang === "ar" ? "تثبيت" : "Pin"}</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col gap-2 lg:w-40">
                              <p className="text-xs text-muted-foreground">
                                {report.createdAt ? new Date(report.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "â€”"}
                              </p>
                              <button
                                type="button"
                                disabled={savingPendingBodyId === report.id}
                                onClick={() => void savePendingReportBody(report.id)}
                                className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-bold hover:bg-secondary/80 disabled:opacity-60"
                              >
                                {savingPendingBodyId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 inline" />}{" "}
                                {lang === "ar" ? "حفظ التعديلات" : "Save edits"}
                              </button>
                              <button type="button" onClick={() => void approveReport(report)} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">
                                {lang === "ar" ? "اعتماد" : "Approve"}
                              </button>
                              <button type="button" onClick={() => void rejectReport(report)} className="rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-white hover:opacity-90">
                                {lang === "ar" ? "رفض" : "Reject"}
                              </button>
                              <button
                                type="button"
                                disabled={deletingPendingId === report.id}
                                onClick={() => void deletePendingReportDoc(report.id)}
                                className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                              >
                                {deletingPendingId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 inline" />}{" "}
                                {lang === "ar" ? "حذف" : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {activeTab === "visitors" && (
                <div className="space-y-6">
                  <section className="glass-panel rounded-3xl p-5 md:p-8">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-black">{lang === "ar" ? "زوار الموقع" : "Site visitors"}</h2>
                        <p className="text-sm text-muted-foreground">{lang === "ar" ? "آخر الطلبات المسجّلة (مسار، IP، إيميل الدخول إن وُجد)." : "Recent requests with path, IP, and login email when available."}</p>
                      </div>
                      <button
                        type="button"
                        disabled={visitorLogsLoading}
                        onClick={() => void fetchVisitorData()}
                        className="rounded-xl bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/70 disabled:opacity-60"
                      >
                        {visitorLogsLoading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null}{" "}
                        {lang === "ar" ? "تحديث" : "Refresh"}
                      </button>
                    </div>
                    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {[
                        [lang === "ar" ? "زيارات مسجلة" : "Visits", visitorLogs.length],
                        [lang === "ar" ? "زوار مميزون" : "Unique visitors", visitorStats.uniqueVisitors],
                        [lang === "ar" ? "مستخدمون مسجلون" : "Signed-in users", visitorStats.signedIn],
                        [lang === "ar" ? "مدن" : "Cities", visitorStats.cities],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-2xl border border-border bg-background/60 p-3">
                          <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
                          <p className="mt-1 text-2xl font-black text-primary">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="border-b border-border bg-secondary/40 text-xs font-black uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">{lang === "ar" ? "الوقت" : "Time"}</th>
                            <th className="px-3 py-2">IP</th>
                            <th className="px-3 py-2">{lang === "ar" ? "الموقع التقريبي" : "Approx. location"}</th>
                            <th className="px-3 py-2">{lang === "ar" ? "المسار" : "Path"}</th>
                            <th className="px-3 py-2">{lang === "ar" ? "الإيميل" : "Email"}</th>
                            <th className="px-3 py-2">{lang === "ar" ? "الجهاز" : "Device"}</th>
                            <th className="px-3 py-2">{lang === "ar" ? "إجراء" : "Action"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visitorLogs.map((row) => (
                            <tr key={row.id} className="border-b border-border/60">
                              <td className="px-3 py-2 whitespace-nowrap text-xs">
                                {row.createdAt ? new Date(row.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "â€”"}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs" dir="ltr">{row.clientIp || "â€”"}</td>
                              <td className="px-3 py-2 text-xs">{[row.city, row.region, row.country].filter(Boolean).join(", ") || "—"}</td>
                              <td className="px-3 py-2 text-xs break-all" dir="ltr">{row.path || "â€”"}</td>
                              <td className="px-3 py-2 text-xs break-all" dir="ltr">{row.email || row.userId || "â€”"}</td>
                              <td className="max-w-[220px] truncate px-3 py-2 text-[11px] text-muted-foreground" dir="ltr" title={row.userAgent || ""}>{row.userAgent || "—"}</td>
                              <td className="px-3 py-2">
                                {row.clientIp ? (
                                  <button
                                    type="button"
                                    disabled={blockingIpBusy === row.clientIp}
                                    onClick={() => void blockVisitorIp(String(row.clientIp))}
                                    className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2 py-1 text-[11px] font-bold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                                  >
                                    <ShieldBan className="h-3.5 w-3.5" />
                                    {lang === "ar" ? "حظر IP" : "Block IP"}
                                  </button>
                                ) : (
                                  "â€”"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {visitorLogs.length === 0 && !visitorLogsLoading && (
                        <p className="p-6 text-sm text-muted-foreground">{lang === "ar" ? "لا توجد سجلات بعد." : "No visit logs yet."}</p>
                      )}
                    </div>
                  </section>
                  <section className="glass-panel rounded-3xl p-5 md:p-8">
                    <h3 className="text-lg font-black mb-3">{lang === "ar" ? "عناوين IP المحظورة" : "Blocked IP addresses"}</h3>
                    <div className="flex flex-wrap gap-2">
                      {blockedIpRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا يوجد حظر حالياً." : "No blocks yet."}</p>
                      ) : (
                        blockedIpRows.map((row) => (
                          <div key={row.id} className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs">
                            <span className="font-mono" dir="ltr">{row.ip || row.id}</span>
                            <button
                              type="button"
                              disabled={blockingIpBusy === row.id}
                              onClick={() => void unblockVisitorIp(row.id)}
                              className="font-bold text-destructive hover:underline disabled:opacity-60"
                            >
                              {lang === "ar" ? "إلغاء" : "Unblock"}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "all-reports" && (
                <section className="glass-panel rounded-3xl p-5 md:p-8">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-black">{lang === "ar" ? "كل البلاغات في الموقع" : "All site reports"}</h2>
                      <p className="text-sm text-muted-foreground">{lang === "ar" ? "تعديل الحالة أو النصوص، أو الحذف." : "Edit status or text, or delete."}</p>
                    </div>
                    {allReportsLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                  </div>
                  <input
                    value={allReportsSearch}
                    onChange={(e) => setAllReportsSearch(e.target.value)}
                    className="input mb-4 max-w-2xl"
                    placeholder={lang === "ar" ? "بحث: صفحة، مُبلّغ، حالة..." : "Search page, reporter, status..."}
                  />
                  <div className="space-y-4">
                    {filteredAllReports.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا بلاغات." : "No reports."}</p>
                    ) : (
                      filteredAllReports.map((report) => {
                        const pageLabel = targetNameById[String(report.targetId || "")] || report.targetName || "â€”";
                        return (
                          <div key={report.id} className="rounded-2xl border border-border bg-background/60 p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-mono text-muted-foreground" dir="ltr">#{report.id}</span>
                              <span className="rounded-full bg-secondary px-2 py-0.5 font-bold">{String(report.status || "")}</span>
                            </div>
                            <p className="text-sm font-bold">
                              {lang === "ar" ? "الصفحة / الهدف: " : "Page / target: "}
                              <span className="text-primary dark:text-neon-blue">{pageLabel}</span>
                            </p>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <Field label={lang === "ar" ? "اسم الهدف في البلاغ" : "Target name on report"}>
                                <input
                                  value={allReportEdits[report.id]?.targetName ?? ""}
                                  onChange={(e) =>
                                    setAllReportEdits((prev) => ({
                                      ...prev,
                                      [report.id]: { ...(prev[report.id] || {} as any), targetName: e.target.value },
                                    }))
                                  }
                                  className="input"
                                />
                              </Field>
                              <Field label={lang === "ar" ? "اسم المُبلّغ" : "Reporter name"}>
                                <input
                                  value={allReportEdits[report.id]?.reporterName ?? ""}
                                  onChange={(e) =>
                                    setAllReportEdits((prev) => ({
                                      ...prev,
                                      [report.id]: { ...(prev[report.id] || {} as any), reporterName: e.target.value },
                                    }))
                                  }
                                  className="input"
                                />
                              </Field>
                              <Field label={lang === "ar" ? "التصنيف" : "Category"}>
                                <select
                                  value={allReportEdits[report.id]?.category ?? "scam"}
                                  onChange={(e) =>
                                    setAllReportEdits((prev) => ({
                                      ...prev,
                                      [report.id]: { ...(prev[report.id] || {} as any), category: e.target.value },
                                    }))
                                  }
                                  className="input"
                                >
                                  <option value="scam">scam</option>
                                  <option value="delay">delay</option>
                                  <option value="bad_treatment">bad_treatment</option>
                                  <option value="suspicious_untrusted">suspicious_untrusted</option>
                                  <option value="successful_transaction">successful_transaction</option>
                                </select>
                              </Field>
                              <Field label={lang === "ar" ? "الحالة" : "Status"}>
                                <select
                                  value={allReportEdits[report.id]?.status ?? "pending"}
                                  onChange={(e) =>
                                    setAllReportEdits((prev) => ({
                                      ...prev,
                                      [report.id]: { ...(prev[report.id] || {} as any), status: e.target.value },
                                    }))
                                  }
                                  className="input"
                                >
                                  <option value="pending">pending</option>
                                  <option value="approved">approved</option>
                                  <option value="rejected">rejected</option>
                                </select>
                              </Field>
                            </div>
                            <Field label={lang === "ar" ? "الوصف" : "Description"}>
                              <textarea
                                value={allReportEdits[report.id]?.description ?? ""}
                                onChange={(e) =>
                                  setAllReportEdits((prev) => ({
                                    ...prev,
                                    [report.id]: { ...(prev[report.id] || {} as any), description: e.target.value },
                                  }))
                                }
                                className="input min-h-[80px]"
                              />
                            </Field>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={savingAllReportId === report.id}
                                onClick={() => void saveAllReportRow(report.id)}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
                              >
                                {savingAllReportId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                {lang === "ar" ? "حفظ" : "Save"}
                              </button>
                              <button
                                type="button"
                                disabled={deletingAllReportId === report.id}
                                onClick={() => void deleteAllReportRow(report.id)}
                                className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                              >
                                {deletingAllReportId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                {lang === "ar" ? "حذف" : "Delete"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 block">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DynamicSection({
  title,
  action,
  onAdd,
  children,
}: {
  title: string;
  action: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black">{title}</h3>
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-bold hover:bg-secondary/70">
          <Plus className="w-4 h-4" />
          {action}
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 rounded-xl border border-border px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={label} title={label}>
      {children}
    </button>
  );
}

function AlertBox({ tone, text }: { tone: "danger" | "success"; text: string }) {
  const isSuccess = tone === "success";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${isSuccess ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
      <div className="flex items-center gap-2">
        {isSuccess ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        <span>{text}</span>
      </div>
    </div>
  );
}

function AccessMessage({ tone, title, text }: { tone: "warning" | "danger"; title: string; text: string }) {
  const isDanger = tone === "danger";
  return (
    <div className={`glass-panel rounded-2xl p-6 border ${isDanger ? "border-destructive/30" : "border-yellow-500/30"}`}>
      <div className={`flex items-start gap-3 ${isDanger ? "text-destructive" : "text-yellow-500"}`}>
        <AlertCircle className="w-5 h-5 mt-0.5" />
        <div>
          <p className="font-bold">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{text}</p>
        </div>
      </div>
    </div>
  );
}

function UnauthorizedNotFound() {
  notFound();
  return null;
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "facebook") return <Facebook className={className} />;
  if (platform === "instagram") return <Instagram className={className} />;
  if (platform === "youtube") return <Youtube className={className} />;
  if (platform === "telegram") return <Send className={className} />;
  if (platform === "website") return <Globe2 className={className} />;
  return <LinkIcon className={className} />;
}
