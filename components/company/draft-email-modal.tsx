"use client";

/**
 * Draft Email modal — three selections (recommended-play step, contact,
 * style), Generate, then Copy or change any selection and regenerate.
 * The server re-derives everything from the stored result; this component
 * only sends indices/ids to POST /api/email.
 */
import { useCallback, useState } from "react";
import { Check, Copy, Loader2, Mail, X } from "lucide-react";
import { EMAIL_STYLES, DEFAULT_STYLE_KEY } from "@/lib/email-styles";
import { cn } from "@/lib/utils";

export interface EmailContactOption {
  id: string;
  name: string;
  title: string | null;
  verified: boolean;
}

const NO_CONTACT = "__none__";

function fieldLabel(text: string) {
  return (
    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">{text}</p>
  );
}

export function DraftEmailModal({
  resultId,
  playSteps,
  contacts,
}: {
  resultId: string;
  playSteps: string[];
  contacts: EmailContactOption[];
}) {
  const [open, setOpen] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [contactId, setContactId] = useState<string>(contacts[0]?.id ?? NO_CONTACT);
  const [styleKey, setStyleKey] = useState(DEFAULT_STYLE_KEY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result_id: resultId,
          play_index: playIndex,
          contact_id: contactId === NO_CONTACT ? null : contactId,
          style_key: styleKey,
        }),
      });
      const json = (await res.json()) as { subject?: string; body?: string; error?: string };
      if (!res.ok || !json.subject || !json.body) {
        throw new Error(json.error ?? "Drafting failed — try again.");
      }
      setDraft({ subject: json.subject, body: json.body });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drafting failed — try again.");
    } finally {
      setBusy(false);
    }
  }, [resultId, playIndex, contactId, styleKey]);

  const copy = useCallback(
    async (which: "subject" | "body") => {
      if (!draft) return;
      await navigator.clipboard.writeText(which === "subject" ? draft.subject : draft.body);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    },
    [draft],
  );

  if (playSteps.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-ink px-4 py-3 font-disp text-[13px] font-bold uppercase tracking-[.06em] text-white transition-opacity hover:opacity-90"
      >
        <Mail size={15} aria-hidden />
        Draft email message
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-card border border-line bg-card shadow-lg">
            <div className="flex items-center gap-3 border-b border-line-2 px-6 py-4">
              <h2 className="font-disp text-[17px] font-semibold text-ink">Draft email message</h2>
              <span className="mono text-[11px] text-muted">pick play · contact · style</span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                className="text-muted hover:text-ink"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* 1 · play */}
              {fieldLabel("1 · Recommended play to pitch")}
              <div className="mb-5 flex flex-col gap-2">
                {playSteps.map((step, i) => (
                  <label
                    key={i}
                    className={cn(
                      "flex cursor-pointer gap-2.5 rounded-[10px] border px-3 py-2.5 text-[12.5px] leading-[1.45]",
                      playIndex === i
                        ? "border-steel bg-[#F4F7FB] text-ink"
                        : "border-line-2 text-slate hover:border-line",
                    )}
                  >
                    <input
                      type="radio"
                      name="play"
                      className="sr-only"
                      checked={playIndex === i}
                      onChange={() => setPlayIndex(i)}
                    />
                    <span
                      className={cn(
                        "mono grid h-[20px] w-[20px] flex-shrink-0 place-items-center rounded-[6px] text-[10.5px] font-bold",
                        playIndex === i ? "bg-ink text-white" : "bg-line-2 text-muted",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </label>
                ))}
              </div>

              {/* 2 · contact */}
              {fieldLabel("2 · Contact")}
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="mb-5 w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-steel"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.title ? ` — ${c.title}` : ""}
                    {c.verified ? "" : " (unverified)"}
                  </option>
                ))}
                <option value={NO_CONTACT}>No named contact — write for IT leadership</option>
              </select>

              {/* 3 · style */}
              {fieldLabel("3 · Tone & length")}
              <div className="mb-5 grid gap-2 sm:grid-cols-2">
                {EMAIL_STYLES.map((s) => (
                  <label
                    key={s.key}
                    className={cn(
                      "cursor-pointer rounded-[10px] border px-3 py-2.5",
                      styleKey === s.key
                        ? "border-steel bg-[#F4F7FB]"
                        : "border-line-2 hover:border-line",
                    )}
                  >
                    <input
                      type="radio"
                      name="style"
                      className="sr-only"
                      checked={styleKey === s.key}
                      onChange={() => setStyleKey(s.key)}
                    />
                    <span className="block font-disp text-[13px] font-semibold text-ink">
                      {s.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-[1.4] text-muted">
                      {s.hint}
                    </span>
                  </label>
                ))}
              </div>

              {error && (
                <p className="mb-4 rounded-[10px] border border-[#F3D9D9] bg-[#FDF3F3] px-3 py-2.5 text-[12.5px] text-[#B4453E]">
                  {error}
                </p>
              )}

              {draft && (
                <div className="mb-2 rounded-[11px] border border-line bg-[#FBFCFD]">
                  <div className="flex items-center gap-2 border-b border-line-2 px-4 py-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.08em] text-muted">
                      Subject
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                      {draft.subject}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy("subject")}
                      className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-slate hover:border-[#cdd4de] hover:text-ink"
                    >
                      {copied === "subject" ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                      {copied === "subject" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap px-4 py-4 text-[13.5px] leading-[1.55] text-ink">
                    {draft.body}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-line-2 px-6 py-4">
              <p className="flex-1 text-[11px] leading-[1.4] text-muted">
                Drafted from verified signals only — review before sending and fill in the
                [Your name] / [Your phone] placeholders.
              </p>
              {draft && (
                <button
                  type="button"
                  onClick={() => copy("body")}
                  className="flex items-center gap-1.5 rounded-[10px] border border-line px-3.5 py-2.5 font-disp text-[12.5px] font-bold text-ink hover:border-[#cdd4de]"
                >
                  {copied === "body" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                  {copied === "body" ? "Copied" : "Copy email"}
                </button>
              )}
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="flex items-center gap-2 rounded-[10px] bg-ink px-4 py-2.5 font-disp text-[12.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                {busy ? "Drafting…" : draft ? "Regenerate" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
