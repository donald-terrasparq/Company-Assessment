"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Settings navigation — admin-only tabs are simply absent for members. */
export function SettingsTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/settings", label: "Account" },
    ...(isAdmin
      ? [
          { href: "/settings/users", label: "Users" },
          { href: "/settings/company", label: "Company" },
          { href: "/settings/analysis", label: "Analysis" },
          { href: "/settings/scoring", label: "Scoring" },
          { href: "/settings/data-sources", label: "Data sources" },
          { href: "/settings/contacts", label: "Contacts" },
          { href: "/settings/budget", label: "Budget" },
          { href: "/settings/retention", label: "Retention" },
        ]
      : []),
  ];

  return (
    <div className="mb-[22px] flex w-max max-w-full flex-wrap gap-1.5 rounded-xl border border-line bg-card p-[5px] shadow-card">
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
    </div>
  );
}
