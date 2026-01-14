"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { User, LogOut, UserCircle } from "lucide-react";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();
  const isRTL = useLocale() === "ar";
  const router = useRouter();
  const locale = useLocale();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    // Call logout API
    await fetch("/api/auth/logout", { method: "POST" });
    // Redirect to login page
    router.push(`/${locale}/login`);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full p-2 text-primary-50 hover:bg-primary-600 hover:text-white dark:text-primary-100 dark:hover:bg-primary-800"
        aria-label="User menu"
        title="User menu"
      >
        <UserCircle className="h-6 w-6" />
      </button>

      {isOpen && (
        <div className={`absolute ${isRTL ? "left-0" : "right-0"} z-50 mt-2 w-48 rounded-md border border-primary-200 bg-white py-1 shadow-lg dark:border-primary-700 dark:bg-primary-800`}>
          <button
            onClick={() => {
              setIsOpen(false);
              router.push(`/${locale}/profile`);
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-primary-900 hover:bg-primary-50 dark:text-primary-50 dark:hover:bg-primary-700"
          >
            <User className="h-4 w-4" />
            {t("common.profile")}
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              handleLogout();
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-primary-900 hover:bg-primary-50 dark:text-primary-50 dark:hover:bg-primary-700"
          >
            <LogOut className="h-4 w-4" />
            {t("common.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

