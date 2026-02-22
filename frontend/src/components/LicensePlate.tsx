"use client";

interface LicensePlateProps {
  value: string;
  /** "sm" for tables, "md" for modal titles, "lg" for hero display */
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LicensePlate({ value, size = "md", className = "" }: LicensePlateProps) {
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-sm",
    lg: "px-4 py-2 text-2xl",
  };

  return (
    <span
      className={
        `inline-block font-mono font-bold tracking-widest rounded border-2 border-zinc-500 bg-gradient-to-b from-zinc-100 to-zinc-200 text-zinc-900 shadow-sm dark:from-zinc-600 dark:to-zinc-700 dark:border-zinc-500 dark:text-zinc-100 ${sizeClasses[size]} ${className}`.trim()
      }
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {value}
    </span>
  );
}
