"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Upload, Plus } from "lucide-react";
import { AddCompanyModal } from "@/components/prospects/add-company-modal";

const CRUMBS: Record<string, string> = {
  "/prospects": "Prospects",
  "/company": "Prospects",
  "/lists": "Lists",
  "/signals": "Signals",
  "/settings": "Settings",
};

/** Fired on every keystroke; the prospects table listens and live-filters. */
export const SEARCH_EVENT = "ca:search";

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const crumb =
    Object.entries(CRUMBS).find(([href]) => pathname.startsWith(href))?.[1] ?? "Prospects";

  // clear the box when leaving prospects so a stale query never hides rows
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current.startsWith("/prospects") && !pathname.startsWith("/prospects")) {
      setQ("");
      window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: "" }));
    }
    lastPath.current = pathname;
  }, [pathname]);

  const onSearch = useCallback(
    (value: string) => {
      setQ(value);
      if (pathname.startsWith("/prospects")) {
        window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: value }));
      }
    },
    [pathname],
  );

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-paper/85 px-[30px] py-4 backdrop-blur-md">
      <div className="font-disp text-[15px] font-semibold text-ink">{crumb}</div>

      <div className="ml-2 flex max-w-[340px] flex-1 items-center gap-2 rounded-[10px] border border-line bg-card px-3 py-2 text-muted">
        <Search size={15} aria-hidden />
        <input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !pathname.startsWith("/prospects")) {
              router.push(`/prospects?q=${encodeURIComponent(q)}`);
            }
          }}
          placeholder={
            pathname.startsWith("/prospects")
              ? "Filter companies, industries, signals…"
              : "Search prospects — press Enter"
          }
          className="w-full border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
          aria-label="Search prospects"
        />
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="inline-flex items-center gap-[7px] rounded-[10px] border border-line bg-card px-[15px] py-[9px] text-[13px] font-medium text-ink transition-colors hover:border-[#cdd4de]"
        title="Analyze a single company by name"
      >
        <Plus size={15} aria-hidden />
        Add company
      </button>

      <Link
        href="/lists?upload=1"
        title="Max 100 companies per list"
        className="inline-flex items-center gap-[7px] rounded-[10px] border border-ink bg-ink px-[15px] py-[9px] text-[13px] font-medium text-white transition-colors hover:bg-[#1b2d43]"
      >
        <Upload size={15} aria-hidden />
        Upload list
      </Link>

      {addOpen && <AddCompanyModal onClose={() => setAddOpen(false)} />}
    </header>
  );
}
