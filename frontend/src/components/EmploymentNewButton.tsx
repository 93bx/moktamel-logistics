"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EmploymentModal } from "./EmploymentModal";

export function EmploymentNewButton({ locale }: { locale: string }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const t = useTranslations();

  return (
    <>
      <button
        type="button"
        onClick={() => setAddModalOpen(true)}
        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600"
      >
        + {t("employment.newEmployee")}
      </button>
      <EmploymentModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        locale={locale}
      />
    </>
  );
}
