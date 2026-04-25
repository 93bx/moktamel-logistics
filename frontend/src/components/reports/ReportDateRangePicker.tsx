"use client";

import { parseDate, type CalendarDate } from "@internationalized/date";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo } from "react";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DateRangePicker as AriaDateRangePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  Label,
  Popover,
  RangeCalendar,
  type RangeValue,
} from "react-aria-components";

type ReportDateRangePickerProps = {
  label: string;
  description: string;
  startValue?: string;
  endValue?: string;
  onChange: (key: "date_from" | "date_to", value: string) => void;
  clearLabel: string;
};

export function ReportDateRangePicker({
  label,
  startValue,
  endValue,
  onChange,
  clearLabel,
}: ReportDateRangePickerProps) {
  const value = useMemo<RangeValue<CalendarDate> | null>(() => {
    const start = parseOptionalDate(startValue);
    const end = parseOptionalDate(endValue);
    return start && end ? { start, end } : null;
  }, [startValue, endValue]);

  const clearRange = () => {
    onChange("date_from", "");
    onChange("date_to", "");
  };

  return (
    <AriaDateRangePicker
      value={value}
      onChange={(range) => {
        onChange("date_from", range?.start?.toString() ?? "");
        onChange("date_to", range?.end?.toString() ?? "");
      }}
      shouldForceLeadingZeros
      className="group flex max-w-full flex-col gap-1"
    >
      <Label className="text-xs text-primary/70">{label}</Label>
      <Group className="flex min-h-9 w-full min-w-[200px] items-center overflow-hidden rounded-md border border-zinc-200 bg-white transition data-[focus-within]:border-primary/50 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-clip px-2 [scrollbar-width:none]">
          <DateInput slot="start" className="flex items-center text-xs text-primary outline-none">
            {(segment) => (
              <DateSegment
                segment={segment}
                className="rounded px-0.5 tabular-nums outline-none data-[focused]:bg-primary data-[focused]:text-white data-[placeholder]:text-primary/40"
              />
            )}
          </DateInput>
          <span aria-hidden="true" className="px-1 text-xs text-primary/40">
            -
          </span>
          <DateInput slot="end" className="flex items-center text-xs text-primary outline-none">
            {(segment) => (
              <DateSegment
                segment={segment}
                className="rounded px-0.5 tabular-nums outline-none data-[focused]:bg-primary data-[focused]:text-white data-[placeholder]:text-primary/40"
              />
            )}
          </DateInput>
        </div>
        {value ? (
          <Button
            type="button"
            onPress={clearRange}
            className="flex h-9 w-8 items-center justify-center text-zinc-400 outline-none transition hover:text-red-600"
            aria-label={clearLabel}
          >
            <X className="h-3 w-3" />
          </Button>
        ) : null}
        <Button
          type="button"
          className="flex h-9 w-9 items-center justify-center border-s border-zinc-200 text-primary outline-none transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          aria-label={label}
        >
          <CalendarDays className="h-3 w-3" />
        </Button>
      </Group>
      <FieldError className="text-xs font-medium text-red-600" />
      <Popover
        className="z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95 dark:border-zinc-700 dark:bg-zinc-900"
        placement="bottom start"
      >
        <Dialog className="outline-none">
          <RangeCalendar className="p-3">
            <header className="mb-2 flex items-center justify-between">
              <Button
                slot="previous"
                className="rounded p-1 text-primary outline-none transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-3 w-3 rtl:rotate-180" />
              </Button>
              <Heading className="text-xs font-semibold text-primary" />
              <Button
                slot="next"
                className="rounded p-1 text-primary outline-none transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="h-3 w-3 rtl:rotate-180" />
              </Button>
            </header>
            <CalendarGrid className="w-full border-separate border-spacing-0.5">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="pb-1 text-center text-[0.6rem] font-medium uppercase text-primary/50">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={({ isDisabled, isFocused, isOutsideMonth, isSelected, isSelectionEnd, isSelectionStart }) =>
                      [
                        "h-7 w-7 rounded text-center text-xs outline-none transition",
                        isOutsideMonth ? "text-zinc-300 dark:text-zinc-700" : "text-primary",
                        isSelected ? "bg-primary/10 text-primary" : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                        isSelectionStart || isSelectionEnd ? "bg-primary text-white hover:bg-primary" : "",
                        isFocused ? "ring-1 ring-primary/40" : "",
                        isDisabled ? "cursor-not-allowed opacity-40" : "",
                      ].join(" ")
                    }
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </RangeCalendar>
        </Dialog>
      </Popover>
    </AriaDateRangePicker>
  );
}

function parseOptionalDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}
