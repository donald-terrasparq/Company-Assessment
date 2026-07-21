"use client";

/**
 * Email history card (company detail page): every drafted email/sequence is
 * saved and can be pulled up later — click an entry to view, copy, reuse.
 */
import { useState } from "react";
import { Check, ChevronDown, Copy, History } from "lucide-react";
import { EMAIL_STYLES } from "@/lib/email-styles";
import { cn } from "@/lib/utils";

export interface EmailHistoryEntry {
  id: string;
  contactName: string | null;
  playText: string;
  styleKey: string;
  sequencePosition: number;
  sequenceLength: number;
  subject: string;
  body: string;
  createdAt: string; // ISO
}

export function EmailHistoryCard({ emails }: { emails: EmailHistoryEntry[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (emails.length === 0) return null;
  const visible = expanded ? emails : emails.slice(0, 5);

  async function copy(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <History size={12} aria-hidden />
        <span>Email history</span>
        <span className="h-px flex-1 bg-line-2" />
        <span className="mono normal-case tracking-normal">{emails.length}</span>
      </p>

      <div className="flex flex-col gap-1.5">
        {visible.map((e) => {
          const isOpen = open === e.id;
          const style = EMAIL_STYLES.find((s) => s.key === e.styleKey)?.label ?? e.styleKey;
          return (
            <div key={e.id} className="rounded-[10px] border border-line-2">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : e.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <span className="mono flex-shrink-0 text-[10.5px] text-muted">
                  {e.createdAt.slice(0, 10)}
                </span>
                {e.sequenceLength > 1 && (
                  <span className="mono flex-shrink-0 rounded-[5px] bg-ink px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                    {e.sequencePosition}/{e.sequenceLength}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                  {e.subject}
                </span>
                <ChevronDown
                  size={13}
                  className={cn("flex-shrink-0 text-muted transition-transform", isOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {isOpen && (
                <div className="border-t border-line-2 px-3 py-2.5">
                  <p className="mb-1.5 text-[10.5px] leading-[1.5] text-muted">
                    {e.contactName ? `To ${e.contactName} · ` : ""}
                    {style} · play: {e.playText.slice(0, 80)}
                    {e.playText.length > 80 ? "…" : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-[12px] leading-[1.5] text-ink">{e.body}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => copy(`s${e.id}`, e.subject)}
                      className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10.5px] font-medium text-slate hover:border-[#cdd4de] hover:text-ink"
                    >
                      {copied === `s${e.id}` ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
                      Subject
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(`b${e.id}`, e.body)}
                      className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10.5px] font-medium text-slate hover:border-[#cdd4de] hover:text-ink"
                    >
                      {copied === `b${e.id}` ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
                      Copy email
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {emails.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[11.5px] font-medium text-slate hover:text-ink"
        >
          {expanded ? "Show fewer" : `Show all ${emails.length}`}
        </button>
      )}
    </section>
  );
}
