"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PHASE_6_TABS = ["Analysis", "Data sources", "Budget", "Retention"];

export function SettingsTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/settings", label: "Account" },
    ...(isAdmin ? [{ href: "/settings/users", label: "Users" }] : []),
  ];

  return (
    <div className="mb-[22px] flex w-max gap-1.5 rounded-xl border border-line bg-card p-[5px] shadow-card">
      {tabs.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-lg px-4 py-2 font-disp text-[13px] font-medium text-slate transition-colors",
              active ? "bg-ink text-white" : "hover:text-ink",
            )}
          >
            {label}
          </Link>
        );
      })}
      {PHASE_6_TABS.map((label) => (
        <span
          key={label}
          title="Built in Phase 6"
          className="cursor-not-allowed rounded-lg px-4 py-2 font-disp text-[13px] font-medium text-muted/60"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
