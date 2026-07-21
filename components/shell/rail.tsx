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

/**
 * The 74px ink rail. No standalone brand tile — the ACTIVE tab carries the
 * branding: white icon on the orange spark gradient, same treatment the old
 * brand tile had.
 */
export function Rail({ initials }: { initials: string }) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 flex h-screen w-[74px] flex-shrink-0 flex-col items-center gap-1.5 bg-ink py-[18px] text-white">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active =
          pathname.startsWith(href) ||
          (href === "/prospects" && pathname.startsWith("/company"));
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-xl text-[#8595ab] transition-colors duration-150",
              active
                ? "bg-gradient-to-br from-spark to-[#ff8a5a] text-white shadow-[0_6px_18px_rgba(255,107,74,.4)]"
                : "hover:bg-white/[.07] hover:text-[#cdd6e2]",
            )}
          >
            <Icon size={21} strokeWidth={active ? 2 : 1.8} />
          </Link>
        );
      })}

      <div className="flex-1" />

      <div
        title="Signed in — manage in Settings"
        className={
          initials.length > 2
            ? "grid h-[38px] w-[38px] place-items-center rounded-full bg-[#2b3f56] font-disp text-[8px] font-bold tracking-[.04em] text-[#ccffee]"
            : "grid h-[38px] w-[38px] place-items-center rounded-full bg-[#2b3f56] font-disp text-[13px] font-semibold text-[#ccffee]"
        }
      >
        {initials}
      </div>
    </nav>
  );
}
