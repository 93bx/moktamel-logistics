"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { RecruitmentAddModal } from "./RecruitmentAddModal";
import { RecruitmentBulkAddModal } from "./RecruitmentBulkAddModal";

export function RecruitmentNewButton({ locale }: { locale: string }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkAddModalOpen, setBulkAddModalOpen] = useState(false);
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

  const openBulk = () => {
    setDropdownOpen(false);
    setBulkAddModalOpen(true);
  };

  return (
    <>
      <div className="relative inline-block" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-600"
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
        >
          + {t("recruitment.new")}
          <ChevronDown className="h-4 w-4" />
        </button>
        {dropdownOpen && (
          <div
            className="absolute end-0 top-full z-20 mt-1 min-w-[200px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={openSingle}
              className="w-full px-4 py-2 text-start text-sm text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              {t("recruitment.newCandidate")}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={openBulk}
              className="w-full px-4 py-2 text-start text-sm text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              {t("recruitment.newCandidatesMultiple")}
            </button>
          </div>
        )}
      </div>
      <RecruitmentAddModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        locale={locale}
      />
      <RecruitmentBulkAddModal
        isOpen={bulkAddModalOpen}
        onClose={() => setBulkAddModalOpen(false)}
        locale={locale}
      />
    </>
  );
}
