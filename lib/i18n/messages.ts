export type Lang = "en" | "ar";

export const messages = {
  en: {
    common: {
      loading: "Loading...",
      dashboard: "Dashboard",
      login: "Sign in",
      logout: "Log out",
      myAccount: "My account",
      trusted: "Trusted",
      highRisk: "High risk",
      reviewing: "Under review",
    },
    navbar: {
      home: "Home",
      report: "Rate & Share",
      dashboard: "Dashboard",
      trending: "Trending",
      about: "About",
      signIn: "Sign in",
    },
  },
  ar: {
    common: {
      loading: "جاري التحميل...",
      dashboard: "لوحة التحكم",
      login: "تسجيل الدخول",
      logout: "خروج",
      myAccount: "حسابي",
      trusted: "موثوق",
      highRisk: "عالي الخطورة",
      reviewing: "قيد المراجعة",
    },
    navbar: {
      home: "الرئيسية",
      report: "قيم & شارك",
      dashboard: "لوحة الإضافة",
      trending: "الأكثر بلاغاً",
      about: "عن المنصة",
      signIn: "تسجيل الدخول",
    },
  },
} as const;

