"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rows3, List, Activity, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/prospects", label: "Prospects", icon: Rows3 },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/signals", label: "Signals", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/** The 74px ink rail from the prototype: brand tile, four nav icons, avatar. */
export function Rail() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 flex h-screen w-[74px] flex-shrink-0 flex-col items-center gap-1.5 bg-ink py-[18px] text-white">
      <div
        title="Company Assessment"
        className="mb-[18px] grid h-10 w-10 flex-shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-spark to-[#ff8a5a] shadow-[0_6px_18px_rgba(255,107,74,.4)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v18M5 8v8M19 8v8M8.5 5.5v13M15.5 5.5v13"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative grid h-11 w-11 place-items-center rounded-xl text-[#8595ab] transition-colors duration-150",
              "hover:bg-white/[.07] hover:text-[#cdd6e2]",
              active && "bg-white/10 text-white",
            )}
          >
            {active && (
              <span className="absolute -left-[18px] bottom-3 top-3 w-[3px] rounded-[3px] bg-spark" />
            )}
            <Icon size={21} strokeWidth={1.8} />
          </Link>
        );
      })}

      <div className="flex-1" />

      <div className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#2b3f56] font-disp text-[13px] font-semibold text-[#ccffee]">
        CM
      </div>
    </nav>
  );
}
