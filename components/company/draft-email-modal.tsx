"use client";

/**
 * Draft Email modal — four selections: (1) recommended-play step, (2) contact,
 * (3) tone & length, (4) sequence size (1–4 emails). With 2+ emails, each
 * follow-up gets its own play selector (contact + tone stay the same), and
 * every generated email renders in its own box labeled with its sequence
 * number and play, with per-email Copy and Regenerate.
 */
import { useCallback, useState } from "react";
import { Check, Copy, Loader2, Mail, RefreshCw, X } from "lucide-react";
import { EMAIL_STYLES, DEFAULT_STYLE_KEY } from "@/lib/email-styles";
import { cn } from "@/lib/utils";

export interface EmailContactOption {
  id: string;
  name: string;
  title: string | null;
  verified: boolean;
  hasEmail: boolean; // enriched with a revealed email address
}

const NO_CONTACT = "__none__";

interface Draft {
  position: number; // 1-based sequence number
  playIndex: number;
  subject: string;
  body: string;
}

function fieldLabel(text: string) {
  return (
    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">{text}</p>
  );
}

/** Short label for a play step: "Play 2 — Offer a Starlink failover pilot." */
function playLabel(playSteps: string[], index: number): string {
  const step = playSteps[index] ?? "";
  const lead = step.split(". ")[0];
  return `Play ${index + 1} — ${lead.length > 60 ? `${lead.slice(0, 57)}…` : lead}${lead.endsWith(".") ? "" : "."}`;
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
  const [playIndex, setPlayIndex] = useState(0); // email 1's play
  const [contactId, setContactId] = useState<string>(contacts[0]?.id ?? NO_CONTACT);
  const [styleKey, setStyleKey] = useState(DEFAULT_STYLE_KEY);
  const [seqLen, setSeqLen] = useState(1);
  // plays for follow-up emails 2..4; defaults cycle through the steps
  const [followUpPlays, setFollowUpPlays] = useState<number[]>([]);
  const [busy, setBusy] = useState<"all" | number | null>(null); // number = regenerating that position
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const playForPosition = useCallback(
    (position: number): number => {
      if (position === 1) return playIndex;
      return followUpPlays[position - 2] ?? (playIndex + position - 1) % playSteps.length;
    },
    [playIndex, followUpPlays, playSteps.length],
  );

  const requestDraft = useCallback(
    async (position: number, length: number): Promise<Draft> => {
      const pIdx = playForPosition(position);
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result_id: resultId,
          play_index: pIdx,
          contact_id: contactId === NO_CONTACT ? null : contactId,
          style_key: styleKey,
          sequence_position: position,
          sequence_length: length,
        }),
      });
      const json = (await res.json()) as { subject?: string; body?: string; error?: string };
      if (!res.ok || !json.subject || !json.body) {
        throw new Error(json.error ?? `Email ${position} failed — try again.`);
      }
      return { position, playIndex: pIdx, subject: json.subject, body: json.body };
    },
    [resultId, contactId, styleKey, playForPosition],
  );

  const generateAll = useCallback(async () => {
    setBusy("all");
    setError(null);
    setDrafts([]);
    try {
      const out: Draft[] = [];
      for (let pos = 1; pos <= seqLen; pos++) {
        out.push(await requestDraft(pos, seqLen));
        setDrafts([...out]); // stream boxes in as they finish
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drafting failed — try again.");
    } finally {
      setBusy(null);
    }
  }, [seqLen, requestDraft]);

  const regenerateOne = useCallback(
    async (position: number) => {
      setBusy(position);
      setError(null);
      try {
        const fresh = await requestDraft(position, seqLen);
        setDrafts((d) => d.map((x) => (x.position === position ? fresh : x)));
      } catch (e) {
        setError(e instanceof Error ? e.message : `Email ${position} failed — try again.`);
      } finally {
        setBusy(null);
      }
    },
    [requestDraft, seqLen],
  );

  const copy = useCallback(async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  }, []);

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
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-card border border-line bg-card shadow-lg">
            <div className="flex items-center gap-3 border-b border-line-2 px-6 py-4">
              <h2 className="font-disp text-[17px] font-semibold text-ink">Draft email message</h2>
              <span className="mono text-[11px] text-muted">play · contact · style · sequence</span>
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
              {/* 1 · play (email 1) */}
              {fieldLabel(seqLen > 1 ? "1 · Play for email 1" : "1 · Recommended play to pitch")}
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
              {contacts.some((c) => c.hasEmail) && (
                <p className="-mt-1 mb-1.5 text-[10.5px] text-muted">✉ = email on file</p>
              )}
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="mb-5 w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-steel"
              >
                {[...contacts]
                  .sort((a, b) => Number(b.hasEmail) - Number(a.hasEmail))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.hasEmail ? "✉ " : ""}
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

              {/* 4 · sequence */}
              {fieldLabel("4 · Sequence")}
              <div className="mb-3 flex items-center gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSeqLen(n)}
                    className={cn(
                      "rounded-[10px] border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                      seqLen === n
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-card text-slate hover:border-[#cdd4de]",
                    )}
                  >
                    {n === 1 ? "1 email" : `${n} emails`}
                  </button>
                ))}
                <span className="text-[11px] text-muted">
                  {seqLen === 1
                    ? "single outreach email"
                    : "a follow-up cadence — same contact & tone, a different play per email"}
                </span>
              </div>

              {/* follow-up play selectors for emails 2..N */}
              {seqLen > 1 && (
                <div className="mb-5 flex flex-col gap-2">
                  {Array.from({ length: seqLen - 1 }, (_, i) => {
                    const position = i + 2;
                    const current = playForPosition(position);
                    return (
                      <div key={position} className="flex items-center gap-2.5">
                        <span className="mono w-[64px] flex-shrink-0 text-[11px] font-bold text-muted">
                          Email {position}
                        </span>
                        <select
                          value={current}
                          onChange={(e) => {
                            const next = [...followUpPlays];
                            next[i] = Number(e.target.value);
                            setFollowUpPlays(next);
                          }}
                          className="w-full rounded-[10px] border border-line bg-card px-3 py-2 text-[12.5px] text-ink outline-none focus:border-steel"
                          aria-label={`Play for email ${position}`}
                        >
                          {playSteps.map((_, idx) => (
                            <option key={idx} value={idx}>
                              {playLabel(playSteps, idx)}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {error && (
                <p className="mb-4 rounded-[10px] border border-[#F3D9D9] bg-[#FDF3F3] px-3 py-2.5 text-[12.5px] text-[#B4453E]">
                  {error}
                </p>
              )}

              {/* generated sequence — one box per email */}
              {drafts.map((d) => (
                <div key={d.position} className="mb-3 rounded-[11px] border border-line bg-[#FBFCFD]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-line-2 px-4 py-2.5">
                    <span className="mono rounded-[6px] bg-ink px-2 py-0.5 text-[10.5px] font-bold text-white">
                      EMAIL {d.position} / {seqLen}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate"
                      title={playSteps[d.playIndex]}
                    >
                      {playLabel(playSteps, d.playIndex)}
                    </span>
                    <button
                      type="button"
                      onClick={() => regenerateOne(d.position)}
                      disabled={busy !== null}
                      className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-slate hover:border-[#cdd4de] hover:text-ink disabled:opacity-50"
                    >
                      {busy === d.position ? (
                        <Loader2 size={12} className="animate-spin" aria-hidden />
                      ) : (
                        <RefreshCw size={12} aria-hidden />
                      )}
                      Regenerate
                    </button>
                  </div>
                  <div className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.08em] text-muted">
                      Subject
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                      {d.subject}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(`s${d.position}`, d.subject)}
                      className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-slate hover:border-[#cdd4de] hover:text-ink"
                    >
                      {copied === `s${d.position}` ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                      {copied === `s${d.position}` ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap px-4 py-3.5 text-[13px] leading-[1.55] text-ink">
                    {d.body}
                  </p>
                  <div className="flex justify-end border-t border-line-2 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => copy(`b${d.position}`, d.body)}
                      className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ink hover:border-[#cdd4de]"
                    >
                      {copied === `b${d.position}` ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                      {copied === `b${d.position}` ? "Copied" : "Copy email"}
                    </button>
                  </div>
                </div>
              ))}
              {busy === "all" && drafts.length < seqLen && (
                <p className="mb-2 flex items-center gap-2 text-[12px] text-muted">
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                  Drafting email {drafts.length + 1} of {seqLen}…
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-line-2 px-6 py-4">
              <p className="flex-1 text-[11px] leading-[1.4] text-muted">
                Drafted from verified signals only — review before sending and fill in the
                [Your name] / [Your phone] placeholders.
              </p>
              <button
                type="button"
                onClick={generateAll}
                disabled={busy !== null}
                className="flex items-center gap-2 rounded-[10px] bg-ink px-4 py-2.5 font-disp text-[12.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy === "all" && <Loader2 size={14} className="animate-spin" aria-hidden />}
                {busy === "all"
                  ? "Drafting…"
                  : drafts.length > 0
                    ? seqLen > 1
                      ? "Regenerate all"
                      : "Regenerate"
                    : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
