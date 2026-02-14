"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EmploymentModal } from "./EmploymentModal";

export function EmploymentNewButton({ locale }: { locale: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const t = useTranslations();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-600"
      >
        + {t("common.new")}
      </button>
      <EmploymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        locale={locale}
      />
    </>
  );
}

