"use client";

/**
 * Danger zone at the bottom of the company detail page: two-step delete.
 * First click expands an explicit warning; only "Yes, delete permanently"
 * submits. Deleting removes the company from its list along with every
 * result, signal, contact, and drafted email — no undo.
 */
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteCompanyAction } from "@/app/(shell)/company/[resultId]/actions";

export function DeleteCompanyButton({
  companyId,
  companyName,
  listName,
}: {
  companyId: string;
  companyName: string;
  listName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <section className="mt-5 rounded-card border border-[#F2D8D4] bg-card p-5 shadow-card">
      <p className="mb-3 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-spark">
        <span>Danger zone</span>
        <span className="h-px flex-1 bg-[#F2D8D4]" />
      </p>
      {!confirming ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="max-w-[60ch] text-[12.5px] leading-[1.5] text-slate">
            Remove <b className="font-semibold text-ink">{companyName}</b> from{" "}
            {listName} and all prospect views. Its scores, signals, contacts, and
            drafted emails are deleted with it.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 py-2 text-[12.5px] font-semibold text-spark transition-colors hover:border-[#e8b5ae]"
          >
            <Trash2 size={14} aria-hidden />
            Delete company
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="max-w-[52ch] text-[12.5px] font-medium leading-[1.5] text-spark">
            Permanently delete {companyName}? This removes it from {listName} and
            every prospect view, with no undo.
          </p>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-[10px] border border-line bg-card px-3.5 py-2 text-[12.5px] font-medium text-slate transition-colors hover:border-[#cdd4de] hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <form action={deleteCompanyAction} onSubmit={() => setBusy(true)} className="inline">
            <input type="hidden" name="company_id" value={companyId} />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-[10px] border border-spark bg-spark px-3.5 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Trash2 size={14} aria-hidden />
              )}
              Yes, delete permanently
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
