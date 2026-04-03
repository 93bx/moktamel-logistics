"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { EmploymentModal } from "./EmploymentModal";

export function EmploymentNewButton({ locale }: { locale: string }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openSingle = () => {
    setDropdownOpen(false);
    setAddModalOpen(true);
  };

  return (
    <>
      <div className="relative inline-block" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600"
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
        >
          + {t("common.new")}
          <ChevronDown className="h-4 w-4" />
        </button>
        {dropdownOpen && (
          <div
            className="absolute end-0 top-full z-20 mt-1 min-w-[220px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={openSingle}
              className="w-full px-4 py-2 text-start text-sm text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              {t("employment.newEmployee")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-start text-sm text-primary opacity-60 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              disabled
            >
              {t("employment.newEmployeesMultiple")}
            </button>
          </div>
        )}
      </div>
      <EmploymentModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        locale={locale}
      />
    </>
  );
}
