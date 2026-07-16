"use client";

import { useState } from "react";

export function CopyInviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(
          `${window.location.origin}/register?code=${code}`,
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="rounded-lg border border-line bg-card px-2.5 py-1 text-[11.5px] font-medium text-slate transition-colors hover:border-[#cdd4de] hover:text-ink"
    >
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
}
