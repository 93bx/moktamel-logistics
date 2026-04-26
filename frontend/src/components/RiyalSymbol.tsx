type RiyalSymbolProps = {
  className?: string;
  size?: number;
  width?: number;
  height?: number;
  title?: string;
  decorative?: boolean;
};

export function RiyalSymbol({
  className,
  size = 14,
  width,
  height,
  title,
  decorative = true,
}: RiyalSymbolProps) {
  const computedWidth = width ?? size;
  const computedHeight = height ?? size;
  const ariaHidden = decorative ? true : undefined;
  const role = decorative ? undefined : "img";
  const ariaLabel = decorative ? undefined : title ?? "Riyal";
  const classes = className ? `inline-block shrink-0 align-bottom ${className}` : "inline-block shrink-0 align-bottom";

  return (
    <img
      src="/riyal_symbol.svg"
      alt={decorative ? "" : ariaLabel}
      aria-hidden={ariaHidden}
      role={role}
      title={title}
      width={computedWidth}
      height={computedHeight}
      className={classes}
    />
  );
}
