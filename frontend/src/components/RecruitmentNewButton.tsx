"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RecruitmentAddModal } from "./RecruitmentAddModal";

export function RecruitmentNewButton({ locale }: { locale: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const t = useTranslations();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-600"
      >
        + {t("common.new")}
      </button>
      <RecruitmentAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        locale={locale}
      />
    </>
  );
}

