"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  filterCountries,
  getCountryByNameEn,
  getCountryDisplayName,
  getFlagUrl,
  type Country,
} from "@/data/countries";

const FLAG_SIZE = 24;

export interface NationalitySearchDropdownProps {
  value: string;
  onChange: (value: string) => void;
  locale: "ar" | "en";
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  /** Optional class name for the input (e.g. validation state: danger/success border and background). */
  inputClassName?: string;
}

const defaultInputClass =
  "mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900 disabled:bg-zinc-100 disabled:text-primary/50 dark:disabled:bg-zinc-800";

export function NationalitySearchDropdown({
  value,
  onChange,
  locale,
  disabled = false,
  placeholder,
  required = false,
  inputClassName,
}: NationalitySearchDropdownProps) {
  const t = useTranslations("common");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedCountry = useMemo(
    () => (value ? getCountryByNameEn(value) : undefined),
    [value]
  );

  const filtered = useMemo(() => filterCountries(query), [query]);
  const displayValue = useMemo(() => {
    if (open && query !== "") return query;
    if (selectedCountry) return getCountryDisplayName(selectedCountry, locale);
    return "";
  }, [open, query, selectedCountry, locale]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setHighlightIndex(0);
    if (selectedCountry) {
      setQuery("");
    } else {
      setQuery("");
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, closeDropdown]);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${highlightIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [open, highlightIndex]);

  const handleFocus = () => {
    if (disabled) return;
    setOpen(true);
    if (!selectedCountry) setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeDropdown();
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightIndex]) {
          onChange(filtered[highlightIndex].name_en);
          closeDropdown();
        }
        break;
      default:
        break;
    }
  };

  const handleSelect = (country: Country) => {
    onChange(country.name_en);
    closeDropdown();
  };

  const placeholderText = placeholder ?? t("searchCountry");

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="nationality-listbox"
        aria-activedescendant={
          open && filtered[highlightIndex]
            ? `nationality-option-${highlightIndex}`
            : undefined
        }
        aria-label={t("nationality")}
        disabled={disabled}
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlightIndex(0);
        }}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        required={required}
        placeholder={placeholderText}
        className={inputClassName ?? defaultInputClass}
      />
      {open && (
        <div
          id="nationality-listbox"
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-primary/60">
              {t("noResults")}
            </div>
          ) : (
            filtered.map((country, index) => {
              const name = getCountryDisplayName(country, locale);
              const isHighlighted = index === highlightIndex;
              return (
                <button
                  key={country.code}
                  type="button"
                  role="option"
                  id={`nationality-option-${index}`}
                  data-index={index}
                  aria-selected={isHighlighted}
                  onClick={() => handleSelect(country)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary/5 ${
                    isHighlighted ? "bg-primary/10" : ""
                  }`}
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
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
