"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, SlidersHorizontal, Upload, Bell } from "lucide-react";

const CRUMBS: Record<string, string> = {
  "/prospects": "Prospects",
  "/lists": "Lists",
  "/signals": "Signals",
  "/settings": "Settings",
};

/** Top bar from the prototype: breadcrumb, search, Filter, Upload list, bell. */
export function TopBar() {
  const pathname = usePathname();
  const crumb =
    Object.entries(CRUMBS).find(([href]) => pathname.startsWith(href))?.[1] ??
    "Prospects";

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-paper/85 px-[30px] py-4 backdrop-blur-md">
      <div className="font-disp text-[15px] font-semibold text-ink">{crumb}</div>

      <div className="ml-2 flex max-w-[340px] flex-1 items-center gap-2 rounded-[10px] border border-line bg-card px-3 py-2 text-muted">
        <Search size={15} aria-hidden />
        <input
          placeholder="Search companies, signals, industries…"
          className="w-full border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
        />
      </div>

      <div className="flex-1" />

      <button
        type="button"
        className="inline-flex items-center gap-[7px] rounded-[10px] border border-line bg-card px-[15px] py-[9px] text-[13px] font-medium text-ink transition-colors hover:border-[#cdd4de]"
      >
        <SlidersHorizontal size={15} aria-hidden />
        Filter
      </button>

      <Link
        href="/lists?upload=1"
        title="Max 100 companies per list"
        className="inline-flex items-center gap-[7px] rounded-[10px] border border-ink bg-ink px-[15px] py-[9px] text-[13px] font-medium text-white transition-colors hover:bg-[#1b2d43]"
      >
        <Upload size={15} aria-hidden />
        Upload list
      </Link>

      <button
        type="button"
        title="Notifications"
        className="relative grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-line bg-card text-slate"
      >
        <Bell size={17} aria-hidden />
      </button>
    </header>
  );
}
