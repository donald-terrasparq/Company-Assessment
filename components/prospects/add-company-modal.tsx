"use client";

/**
 * Add-a-company panel (top right, under the header button). One company name,
 * optional website → enqueues a single-company analysis into the shared
 * "Manual Entry" list, then jumps to that list filtered to this session's
 * entries (session ids kept in sessionStorage).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

const SESSION_KEY = "manual-entry-session-ids";

export function rememberSessionCompany(companyId: string): void {
  try {
    const ids = new Set<string>(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]"));
    ids.add(companyId);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
  } catch {
    // storage unavailable — the full list view still works
  }
}

export function sessionCompanyIds(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function AddCompanyModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/companies/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), website: website.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start the search.");
      rememberSessionCompany(json.company_id);
      onClose();
      router.push(`/prospects?list=${json.list_id}&session=1`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the search.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute right-[30px] top-[70px] w-[360px] rounded-card border border-line bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-disp text-[15px] font-semibold text-ink">Add a company</h2>
          <span className="flex-1" />
          <button type="button" onClick={onClose} title="Close" className="text-muted hover:text-ink">
            <X size={16} aria-hidden />
          </button>
        </div>
        <p className="mb-3 text-[11.5px] leading-[1.45] text-muted">
          Runs the full analysis on one company. Manual entries collect in the{" "}
          <b className="text-ink">Manual Entry</b> list with their date of entry.
        </p>

        <label className="mb-2.5 flex flex-col gap-1">
          <span className="text-[11.5px] font-semibold text-slate">Company name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. Micro Center"
            autoFocus
            className="rounded-[10px] border border-line bg-card px-3 py-2 text-[13.5px] text-ink outline-none focus:border-steel"
          />
        </label>
        <label className="mb-3 flex flex-col gap-1">
          <span className="text-[11.5px] font-semibold text-slate">Website (optional)</span>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. microcenter.com"
            className="rounded-[10px] border border-line bg-card px-3 py-2 text-[13.5px] text-ink outline-none focus:border-steel"
          />
        </label>

        {error && (
          <p className="mb-3 rounded-[10px] bg-spark-soft px-3 py-2 text-[12px] font-medium text-spark">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={search}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-ink bg-ink px-4 py-2.5 font-disp text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Search size={14} aria-hidden />}
          {busy ? "Starting analysis…" : "Search"}
        </button>
      </div>
    </div>
  );
}
