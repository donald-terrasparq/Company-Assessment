"use client";

/**
 * Top contacts card (Phase 7). Selecting a contact exposes the two explicit
 * enrichment options — reveal email, then optionally get a direct phone —
 * so Apollo credits are only spent on people the user actually chose.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Mail, Phone, RefreshCw, Search } from "lucide-react";
import { monogramFor } from "@/components/prospects/monogram";
import { cn } from "@/lib/utils";

export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  roleRationale: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  verified: boolean;
  phoneRequested: boolean;
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}

export function ContactsCard({
  resultId,
  contacts,
  apolloReady,
}: {
  resultId: string;
  contacts: ContactRow[];
  apolloReady: boolean; // apollo_enabled setting + APOLLO_API_KEY present
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // "find" | `email:${id}` | `phone:${id}`
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function findContacts() {
    setBusy("find");
    setNotice(null);
    try {
      const res = await fetch("/api/apollo/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result_id: resultId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed.");
      setNotice({
        ok: true,
        text:
          json.added > 0
            ? `Found ${json.found} matching people — ${json.added} added.`
            : `Found ${json.found} matching people — all already on the card.`,
      });
      router.refresh();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Search failed." });
    } finally {
      setBusy(null);
    }
  }

  async function enrich(contactId: string, reveal: "email" | "phone") {
    setBusy(`${reveal}:${contactId}`);
    setNotice(null);
    try {
      const res = await fetch("/api/apollo/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, reveal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Enrichment failed.");
      if (reveal === "phone" && json.status === "requested") {
        setNotice({
          ok: true,
          text: "Phone requested — Apollo delivers it within a minute or two. Refresh to check.",
        });
      }
      router.refresh();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Enrichment failed." });
    } finally {
      setBusy(null);
    }
  }

  async function copy(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>Top contacts</span>
        <span className="h-px flex-1 bg-line-2" />
      </p>

      {apolloReady && (
        <button
          type="button"
          onClick={findContacts}
          disabled={busy === "find"}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-[10px] border border-line bg-[#FBFCFD] px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-[#cdd4de] disabled:opacity-50"
        >
          {busy === "find" ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Search size={14} aria-hidden />
          )}
          {busy === "find" ? "Searching Apollo…" : "Find best contacts — Apollo"}
        </button>
      )}

      {notice && (
        <p
          className={cn(
            "mb-3 rounded-[10px] px-3 py-2 text-[12px] font-medium",
            notice.ok ? "bg-tier1-soft text-tier1" : "bg-spark-soft text-spark",
          )}
        >
          {notice.text}
        </p>
      )}

      {contacts.length === 0 ? (
        <p className="text-[13px] text-muted">
          No contacts surfaced from public sources for this company.
          {apolloReady ? " Try the Apollo search above." : ""}
        </p>
      ) : (
        contacts.map((c) => {
          const avatar = monogramFor(c.name);
          const isSelected = selected === c.id;
          return (
            <div
              key={c.id}
              className={cn(
                "border-b border-line-2 py-3 first:pt-0 last:border-none last:pb-0",
                isSelected && "-mx-2 rounded-[10px] border border-line bg-[#FBFCFD] px-2",
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(isSelected ? null : c.id)}
                className="flex w-full gap-3 text-left"
                title={isSelected ? "Deselect" : "Select to reveal email / phone"}
              >
                <span
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full font-disp text-[14px] font-semibold text-white"
                  style={{ background: avatar.gradient }}
                >
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-disp text-[13.5px] font-semibold text-ink">
                    {c.name}
                    {c.source === "apollo" && (
                      <span className="rounded-md bg-[#EAF1FB] px-1.5 py-0.5 text-[10px] font-semibold text-fwa">
                        Apollo
                      </span>
                    )}
                    {!c.verified && (
                      <span className="rounded-md bg-[#FBF0DA] px-1.5 py-0.5 text-[10px] font-semibold text-tier2">
                        unverified
                      </span>
                    )}
                  </span>
                  {c.title && <span className="mt-0.5 block text-[12px] text-slate">{c.title}</span>}
                  {c.roleRationale && (
                    <span className="mt-1 block text-[11.5px] leading-[1.4] text-muted">
                      {c.roleRationale}
                    </span>
                  )}
                </span>
                {c.linkedinUrl && (
                  <a
                    href={c.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-[7px] bg-[#EAF1FB] font-disp text-[12px] font-bold text-fwa"
                  >
                    in
                  </a>
                )}
              </button>

              {/* revealed details */}
              {(c.email || c.phone) && (
                <div className="mt-2 flex flex-col gap-1 pl-[52px]">
                  {c.email && (
                    <span className="flex items-center gap-2 text-[12px] text-ink">
                      <Mail size={12} className="text-muted" aria-hidden />
                      <a href={`mailto:${c.email}`} className="mono hover:underline">{c.email}</a>
                      <button type="button" onClick={() => copy(`e${c.id}`, c.email!)} className="text-muted hover:text-ink" title="Copy email">
                        {copied === `e${c.id}` ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                      </button>
                    </span>
                  )}
                  {c.phone && (
                    <span className="flex items-center gap-2 text-[12px] text-ink">
                      <Phone size={12} className="text-muted" aria-hidden />
                      <span className="mono">{c.phone}</span>
                      <button type="button" onClick={() => copy(`p${c.id}`, c.phone!)} className="text-muted hover:text-ink" title="Copy phone">
                        {copied === `p${c.id}` ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* enrichment options — only for the SELECTED contact */}
              {isSelected && apolloReady && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[52px]">
                  {!c.email && (
                    <button
                      type="button"
                      onClick={() => enrich(c.id, "email")}
                      disabled={busy !== null}
                      className="flex items-center gap-1.5 rounded-lg border border-ink bg-ink px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#1b2d43] disabled:opacity-50"
                    >
                      {busy === `email:${c.id}` ? (
                        <Loader2 size={12} className="animate-spin" aria-hidden />
                      ) : (
                        <Mail size={12} aria-hidden />
                      )}
                      Reveal email
                    </button>
                  )}
                  {!c.phone && !c.phoneRequested && (
                    <button
                      type="button"
                      onClick={() => enrich(c.id, "phone")}
                      disabled={busy !== null}
                      className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11.5px] font-semibold text-ink hover:border-[#cdd4de] disabled:opacity-50"
                    >
                      {busy === `phone:${c.id}` ? (
                        <Loader2 size={12} className="animate-spin" aria-hidden />
                      ) : (
                        <Phone size={12} aria-hidden />
                      )}
                      Get phone #
                    </button>
                  )}
                  {!c.phone && c.phoneRequested && (
                    <button
                      type="button"
                      onClick={() => router.refresh()}
                      className="flex items-center gap-1.5 rounded-lg border border-line bg-line-2 px-2.5 py-1.5 text-[11.5px] font-medium text-slate"
                      title="Apollo delivers the number asynchronously — refresh to check"
                    >
                      <RefreshCw size={12} aria-hidden />
                      Phone requested — refresh
                    </button>
                  )}
                  <span className="text-[10.5px] text-muted">
                    {!c.email ? "email: 1 credit" : ""}
                    {!c.email && !c.phone && !c.phoneRequested ? " · " : ""}
                    {!c.phone && !c.phoneRequested ? "phone: mobile credit" : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })
      )}

      <p className="mt-3 text-[10.5px] leading-[1.4] text-muted">
        {apolloReady
          ? "Search finds people only — email and phone are pulled per contact you select, so credits are never spent in bulk."
          : "Contacts found via public search — verify names and roles before outreach. Enable Apollo in Settings → Data sources to reveal emails and phone numbers."}
      </p>
    </section>
  );
}
