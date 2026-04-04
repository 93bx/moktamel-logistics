"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { SideNav } from "@/components/SideNav";

const MOBILE_LABEL_MS = 3500;
const MD_MIN_WIDTH = 768;

type AppSidebarProps = {
  companyName?: string | null;
  appTitle: string;
};

export function AppSidebar({ companyName, appTitle }: AppSidebarProps) {
  const [isMdUp, setIsMdUp] = useState(false);
  const [mobileLabelsVisible, setMobileLabelsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_MIN_WIDTH}px)`);
    const apply = () => {
      const matches = mq.matches;
      setIsMdUp(matches);
      if (matches) {
        setMobileLabelsVisible(false);
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const showLabels = isMdUp || mobileLabelsVisible;

  const pulseMobileLabels = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth >= MD_MIN_WIDTH) return;
    setMobileLabelsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setMobileLabelsVisible(false);
      hideTimerRef.current = null;
    }, MOBILE_LABEL_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const title = companyName?.trim() || appTitle;

  return (
    <aside
      role="navigation"
      aria-label={appTitle}
      onClick={pulseMobileLabels}
      className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-primary-700 bg-primary py-4 dark:border-primary-800 dark:bg-primary-900 md:w-64 md:min-w-64 md:px-4 ${
        showLabels
          ? "w-60 min-w-60 max-md:px-3"
          : "w-14 min-w-14 max-md:px-2"
      } transition-[width,min-width,padding] duration-200 ease-out`}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={`flex shrink-0 items-center pb-3 text-lg font-semibold text-white ${
            showLabels
              ? "justify-start gap-2 truncate px-1"
              : "justify-center max-md:px-0 md:justify-start md:gap-2 md:truncate md:px-1"
          }`}
          title={title}
        >
          <Building2 className="h-6 w-6 shrink-0 opacity-90" aria-hidden />
          <span
            className={
              showLabels ? "min-w-0 truncate" : "sr-only md:not-sr-only md:min-w-0 md:truncate"
            }
          >
            {title}
          </span>
        </div>
        <SideNav showLabels={showLabels} />
      </div>
    </aside>
  );
}
