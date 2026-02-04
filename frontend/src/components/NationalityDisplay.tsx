"use client";

import {
  getCountryByNameEn,
  getCountryDisplayName,
  getFlagUrl,
} from "@/data/countries";

const FLAG_SIZE = 24;

export interface NationalityDisplayProps {
  value: string | null;
  locale: "ar" | "en";
  className?: string;
}

export function NationalityDisplay({
  value,
  locale,
  className = "",
}: NationalityDisplayProps) {
  const country = value ? getCountryByNameEn(value) : undefined;

  if (!value || !value.trim()) {
    return <span className={className}>-</span>;
  }

  if (!country) {
    return <span className={className}>{value}</span>;
  }

  const name = getCountryDisplayName(country, locale);

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      title={name}
    >
      
      <img
        src={getFlagUrl(country.code)}
        alt=""
        width={FLAG_SIZE}
        height={Math.round(FLAG_SIZE * 0.75)}
        loading="lazy"
        className="shrink-0 rounded object-cover"
      />
      <span>{name}</span>
    </div>
  );
}
