"use client";

import { Info } from "lucide-react";
import Tooltip from "@mui/material/Tooltip";

interface InfoTooltipProps {
  content: string;
  /** Wider tooltips for long localized explanations */
  maxWidthPx?: number;
  /** Preserve line breaks from translated strings (e.g. Arabic labels with body text) */
  multiline?: boolean;
}

export function InfoTooltip({ content, maxWidthPx = 300, multiline = false }: InfoTooltipProps) {
  return (
    <Tooltip
      title={content}
      arrow
      placement="top"
      enterDelay={200}
      leaveDelay={0}
      sx={{
        "& .MuiTooltip-tooltip": {
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          fontSize: "0.75rem",
          maxWidth: `${maxWidthPx}px`,
          padding: "8px 12px",
          whiteSpace: multiline ? "pre-line" : "normal",
        },
        "& .MuiTooltip-arrow": {
          color: "rgba(0, 0, 0, 0.9)",
        },
      }}
    >
      <Info className="h-4 w-4 text-primary/40 hover:text-primary/60 cursor-help inline-block" />
    </Tooltip>
  );
}
