import { RiyalSymbol } from "@/components/RiyalSymbol";

type SymbolSize = "sm" | "md" | "lg";
type GapSize = "tight" | "normal";

type CurrencyWithRiyalProps = {
  amount: number | string;
  formattedAmount?: string;
  className?: string;
  amountClassName?: string;
  symbolClassName?: string;
  symbolSize?: SymbolSize;
  gap?: GapSize;
  decorativeSymbol?: boolean;
};

const symbolSizeMap: Record<SymbolSize, number> = {
  sm: 12,
  md: 14,
  lg: 18,
};

const gapClassMap: Record<GapSize, string> = {
  tight: "gap-1",
  normal: "gap-1.5",
};

export function CurrencyWithRiyal({
  amount,
  formattedAmount,
  className,
  amountClassName,
  symbolClassName,
  symbolSize = "md",
  gap = "tight",
  decorativeSymbol = true,
}: CurrencyWithRiyalProps) {
  const amountText = formattedAmount ?? String(amount);
  const wrapperClasses = className
    ? `inline-flex items-baseline whitespace-nowrap ${gapClassMap[gap]} ${className}`
    : `inline-flex items-baseline whitespace-nowrap ${gapClassMap[gap]}`;
  const valueClasses = amountClassName ? `tabular-nums ${amountClassName}` : "tabular-nums";

  return (
    <span className={wrapperClasses}>
      <RiyalSymbol
        size={symbolSizeMap[symbolSize]}
        className={symbolClassName}
        decorative={decorativeSymbol}
      />
      <span className={valueClasses}>{amountText}</span>
    </span>
  );
}
