"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "@/lib/i18n/context";

export function LoadingScreen() {
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  useEffect(() => {
    // Simulate initial loading sequence
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <img
              src="https://res.cloudinary.com/dv4qomvdt/image/upload/v1777833692/ChatGPT_Image_May_3_2026_09_41_19_PM_jsklgh.png"
              alt="Trackify"
              className="brand-logo h-16 w-auto max-w-[260px] object-contain rounded-xl mb-6"
            />

            <div className="trackify-loader mb-4" />

            <p className="mt-2 text-muted-foreground">{lang === "ar" ? "جاري فحص قاعدة البيانات..." : "Scanning database..."}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
