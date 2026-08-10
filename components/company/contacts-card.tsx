"use client";

/**
 * Top contacts card (Phase 7). Default view: Name / Title rows with Email and
 * Phone buttons on every contact — one press pulls from Apollo, no selection
 * step. Quick filters (Seniority / Department / Title, pre-filled from the
 * admin defaults in Settings → Contacts) tune the Apollo search per company.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Briefcase,
  Check,
  ChevronDown,
  Copy,
  Factory,
  Loader2,
  Mail,
  Megaphone,
  MonitorCog,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { DEPARTMENT_META, departmentForTitle, type Department } from "@/lib/contacts/department";
import {
  DEPARTMENT_OPTIONS,
  SENIORITY_OPTIONS,
  type ContactPrefs,
} from "@/lib/apollo/prefs";
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
  /** 0015: manual_contacts row backing this contact (manual row or correction). */
  manualId: string | null;
}

const DEPARTMENT_ICONS: Record<Department, LucideIcon> = {
  it: MonitorCog,
  engineering: Wrench,
  finance: Banknote,
  operations: Factory,
  marketing: Megaphone,
  procurement: ShoppingCart,
  general: Briefcase,
};

/** Department tile shown in front of each contact's name/title. */
function DepartmentIcon({ title }: { title: string | null }) {
  const dept = departmentForTitle(title);
  const meta = DEPARTMENT_META[dept];
  const Icon = DEPARTMENT_ICONS[dept];
  return (
    <span
      title={meta.label}
      className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[11px]"
      style={{ background: meta.soft, color: meta.color }}
    >
      <Icon size={19} strokeWidth={1.9} aria-hidden />
    </span>
  );
}

export function ContactsCard({
  resultId,
  companyId,
  contacts,
  apolloReady,
  defaults,
}: {
  resultId: string;
  companyId: string; // manual contacts are keyed on the company (0015)
  contacts: ContactRow[];
  apolloReady: boolean; // apollo_enabled setting + APOLLO env key present
  defaults: ContactPrefs; // admin defaults from Settings → Contacts
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); // "find" | `email:${id}` | `phone:${id}`
  const [contactModal, setContactModal] = useState<null | { mode: "add" } | { mode: "edit"; c: ContactRow }>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [seniorities, setSeniorities] = useState<string[]>(defaults.seniorities);
  const [departments, setDepartments] = useState<string[]>(defaults.departments);
  const [titles, setTitles] = useState(defaults.titles.join(", "));
  // what the displayed contacts were last searched with — UPDATE lights up
  // only when the panel differs from this
  const [applied, setApplied] = useState({
    seniorities: [...defaults.seniorities],
    departments: [...defaults.departments],
    titles: defaults.titles.join(", "),
  });

  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
  const filtersDirty =
    !sameSet(seniorities, applied.seniorities) ||
    !sameSet(departments, applied.departments) ||
    titles.trim() !== applied.titles.trim();

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  // enriched contacts (revealed email/phone) float to the TOP; stable within groups
  const enrichRank = (c: ContactRow) =>
    (c.email ? 2 : 0) + (c.phone ? 2 : 0) + (c.phoneRequested && !c.phone ? 1 : 0);
  const sortedContacts = [...contacts].sort((a, b) => enrichRank(b) - enrichRank(a));

  async function findContacts(loadMore = false) {
    setBusy(loadMore ? "more" : "find");
    setNotice(null);
    try {
      const res = await fetch("/api/apollo/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result_id: resultId,
          load_more: loadMore,
          overrides: {
            seniorities,
            departments,
            titles: titles.split(",").map((t) => t.trim()).filter(Boolean),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed.");
      setHasMore(json.has_more === true);
      if (!loadMore) {
        // auto-relaxation may have loosened the filters server-side — sync
        // the panel so it reflects what actually produced these contacts
        const af = json.applied_filters as
          | { seniorities: string[]; departments: string[]; titles: string[] }
          | undefined;
        const next = af
          ? { seniorities: af.seniorities, departments: af.departments, titles: af.titles.join(", ") }
          : { seniorities: [...seniorities], departments: [...departments], titles };
        setSeniorities(next.seniorities);
        setDepartments(next.departments);
        setTitles(next.titles);
        setApplied({
          seniorities: [...next.seniorities],
          departments: [...next.departments],
          titles: next.titles,
        });
      }
      setNotice({
        ok: true,
        text: loadMore
          ? json.added > 0
            ? `Loaded ${json.added} more of ${json.found} matching people.`
            : `No new people — ${json.found} matches for these filters.`
          : json.relaxed
            ? `No matches for the set filters — auto-broadened (${json.relax_note}) and found ${json.found}. Filters updated to match.`
            : json.added > 0
              ? `Found ${json.found} matching people — ${json.added} shown.`
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

      <div className="mb-3">
          <div className="flex gap-2">
            {apolloReady && (
              <button
                type="button"
                onClick={() => findContacts(false)}
                disabled={busy !== null}
                className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-line bg-[#FBFCFD] px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-[#cdd4de] disabled:opacity-50"
              >
                {busy === "find" ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Search size={14} aria-hidden />
                )}
                {busy === "find" ? "Searching…" : "Find contacts"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setContactModal({ mode: "add" })}
              title="Type in a contact yourself — kept even when the company is re-analyzed"
              className={cn(
                "flex items-center justify-center gap-2 rounded-[10px] border border-line bg-card px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-[#cdd4de]",
                !apolloReady && "flex-1",
              )}
            >
              <UserPlus size={14} aria-hidden />
              Add contact
            </button>
            {apolloReady && (
              <button
                type="button"
                onClick={() => setFiltersOpen(!filtersOpen)}
                title="Title / Seniority / Department filters"
                className={cn(
                  "flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition-colors",
                  filtersOpen
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-card text-slate hover:border-[#cdd4de]",
                )}
              >
                <SlidersHorizontal size={13} aria-hidden />
                <ChevronDown size={12} className={cn("transition-transform", filtersOpen && "rotate-180")} aria-hidden />
              </button>
            )}
          </div>

          {filtersOpen && (
            <div className="mt-2.5 rounded-[10px] border border-line-2 bg-[#FBFCFD] p-3">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-muted">
                Seniority
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {SENIORITY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(seniorities, setSeniorities, o.value)}
                    className={cn(
                      "rounded-[16px] border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      seniorities.includes(o.value)
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-card text-slate hover:border-[#cdd4de]",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-muted">
                Department
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {DEPARTMENT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(departments, setDepartments, o.value)}
                    className={cn(
                      "rounded-[16px] border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      departments.includes(o.value)
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-card text-slate hover:border-[#cdd4de]",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-muted">
                Title keywords
              </p>
              <input
                value={titles}
                onChange={(e) => setTitles(e.target.value)}
                placeholder="VP, Manager, Senior Manager"
                className="w-full rounded-[8px] border border-line bg-card px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-steel"
              />
              <button
                type="button"
                onClick={() => findContacts(false)}
                disabled={!filtersDirty || busy !== null}
                title={
                  filtersDirty
                    ? "Re-search with the changed filters — replaces the contacts shown"
                    : "Change a filter above to enable"
                }
                className={cn(
                  "mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] border px-3 py-2 text-[12.5px] font-bold uppercase tracking-[.04em] transition-colors",
                  filtersDirty
                    ? "border-spark bg-spark text-white hover:opacity-90"
                    : "cursor-not-allowed border-line bg-line-2 text-muted",
                )}
              >
                {busy === "find" ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                ) : (
                  <RefreshCw size={13} aria-hidden />
                )}
                {busy === "find" ? "Updating…" : "Update"}
              </button>
              <p className="mt-2 text-[10.5px] leading-[1.4] text-muted">
                Defaults come from Settings → Contacts. Size guardrail still applies (no CEO
                at $20M+, no C-level past $500M).
              </p>
            </div>
          )}
      </div>

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
          No contacts yet for this company.
          {apolloReady
            ? " New runs pull them automatically — or press Find contacts above."
            : ""}
        </p>
      ) : (
        <div className="max-h-[440px] overflow-y-auto pr-1">
        {sortedContacts.map((c) => {
          return (
            <div
              key={c.id}
              className="border-b border-line-2 py-3 first:pt-0 last:border-none last:pb-0"
            >
              <div className="flex gap-3">
                <DepartmentIcon title={c.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-disp text-[13.5px] font-semibold text-ink">
                    {c.name}
                    {!c.verified && (
                      <span className="rounded-md bg-[#FBF0DA] px-1.5 py-0.5 text-[10px] font-semibold text-tier2">
                        unverified
                      </span>
                    )}
                    {c.source === "manual" && (
                      <span
                        title="Entered by hand — kept even when the company is re-analyzed"
                        className="rounded-md bg-fwa-soft px-1.5 py-0.5 text-[10px] font-semibold text-fwa"
                      >
                        manual
                      </span>
                    )}
                    {c.manualId && c.source !== "manual" && (
                      <span
                        title="A found contact with your corrections applied — they survive re-analysis"
                        className="rounded-md bg-line-2 px-1.5 py-0.5 text-[10px] font-semibold text-slate"
                      >
                        edited
                      </span>
                    )}
                  </div>
                  {c.title && <div className="mt-0.5 text-[12px] text-slate">{c.title}</div>}
                  {c.roleRationale && (
                    <div className="mt-1 text-[11.5px] leading-[1.4] text-muted">
                      {c.roleRationale}
                    </div>
                  )}

                  {/* revealed values */}
                  {c.email && (
                    <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink">
                      <Mail size={12} className="text-muted" aria-hidden />
                      <a href={`mailto:${c.email}`} className="mono hover:underline">{c.email}</a>
                      <button type="button" onClick={() => copy(`e${c.id}`, c.email!)} className="text-muted hover:text-ink" title="Copy email">
                        {copied === `e${c.id}` ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                      </button>
                    </div>
                  )}
                  {c.phone && (
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-ink">
                      <Phone size={12} className="text-muted" aria-hidden />
                      <span className="mono">{c.phone}</span>
                      <button type="button" onClick={() => copy(`p${c.id}`, c.phone!)} className="text-muted hover:text-ink" title="Copy phone">
                        {copied === `p${c.id}` ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                      </button>
                    </div>
                  )}

                  {/* one-press Apollo pulls — for found contacts (manual rows have no Apollo id) */}
                  {apolloReady && c.source !== "manual" && (!c.email || (!c.phone && !c.phoneRequested) || (c.phoneRequested && !c.phone)) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {!c.email && (
                        <button
                          type="button"
                          onClick={() => enrich(c.id, "email")}
                          disabled={busy !== null}
                          className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2 py-1 text-[11px] font-semibold text-ink hover:border-[#cdd4de] disabled:opacity-50"
                          title="Pull work email from Apollo (1 credit)"
                        >
                          {busy === `email:${c.id}` ? (
                            <Loader2 size={11} className="animate-spin" aria-hidden />
                          ) : (
                            <Mail size={11} aria-hidden />
                          )}
                          Email
                        </button>
                      )}
                      {!c.phone && !c.phoneRequested && (
                        <button
                          type="button"
                          onClick={() => enrich(c.id, "phone")}
                          disabled={busy !== null}
                          className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2 py-1 text-[11px] font-semibold text-ink hover:border-[#cdd4de] disabled:opacity-50"
                          title="Pull direct phone from Apollo (mobile credit, arrives ~1 min)"
                        >
                          {busy === `phone:${c.id}` ? (
                            <Loader2 size={11} className="animate-spin" aria-hidden />
                          ) : (
                            <Phone size={11} aria-hidden />
                          )}
                          Phone
                        </button>
                      )}
                      {!c.phone && c.phoneRequested && (
                        <button
                          type="button"
                          onClick={() => router.refresh()}
                          className="flex items-center gap-1.5 rounded-lg border border-line bg-line-2 px-2 py-1 text-[11px] font-medium text-slate"
                          title="Apollo delivers the number asynchronously — refresh to check"
                        >
                          <RefreshCw size={11} aria-hidden />
                          Phone requested
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <span className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  {c.linkedinUrl && (
                    <a
                      href={c.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-[#EAF1FB] font-disp text-[12px] font-bold text-fwa"
                    >
                      in
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setContactModal({ mode: "edit", c })}
                    title={
                      c.source === "manual"
                        ? "Edit this contact"
                        : "Correct name, title, email, or phone — your fix survives re-analysis"
                    }
                    className="grid h-[26px] w-[26px] place-items-center rounded-[7px] border border-line bg-card text-muted transition-colors hover:border-[#cdd4de] hover:text-ink"
                  >
                    <Pencil size={12} aria-hidden />
                  </button>
                </span>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {apolloReady && contacts.length > 0 && hasMore && (
        <button
          type="button"
          onClick={() => findContacts(true)}
          disabled={busy !== null}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-line bg-card px-3 py-2 text-[12px] font-semibold text-slate transition-colors hover:border-[#cdd4de] hover:text-ink disabled:opacity-50"
        >
          {busy === "more" ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <ChevronDown size={13} aria-hidden />
          )}
          {busy === "more" ? "Loading more…" : "Load more matches"}
        </button>
      )}

      <p className="mt-3 text-[10.5px] leading-[1.4] text-muted">
        {apolloReady
          ? "Contacts are pulled automatically on every run. Email and phone are fetched per contact you press — credits are never spent in bulk."
          : "Contacts found via public search — verify names and roles before outreach. Enable Apollo in Settings → Data sources to reveal emails and phone numbers."}
      </p>

      {contactModal && (
        <ContactFormModal
          companyId={companyId}
          state={contactModal}
          onClose={() => setContactModal(null)}
          onSaved={(text) => {
            setContactModal(null);
            setNotice({ ok: true, text });
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

/** First token = first name, the rest = last name — for prefilling edits. */
function splitName(name: string): { first: string; last: string } {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  return { first, last: rest.join(" ") };
}

/**
 * Add / edit modal for manual contacts (0015). Editing an auto-found contact
 * saves a correction row keyed on the company, so the fix survives re-analysis;
 * deleting a correction reverts the contact to its researched data.
 */
function ContactFormModal({
  companyId,
  state,
  onClose,
  onSaved,
}: {
  companyId: string;
  state: { mode: "add" } | { mode: "edit"; c: ContactRow };
  onClose: () => void;
  onSaved: (notice: string) => void;
}) {
  const editing = state.mode === "edit" ? state.c : null;
  const prefill = editing ? splitName(editing.name) : { first: "", last: "" };
  const [firstName, setFirstName] = useState(prefill.first);
  const [lastName, setLastName] = useState(prefill.last);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isManualRow = editing?.source === "manual";
  const fields = {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    title: title.trim(),
    email: email.trim(),
    phone: phone.trim(),
  };

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const editExisting = editing?.manualId != null;
      const res = await fetch("/api/contacts", {
        method: editExisting ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editExisting
            ? { id: editing!.manualId, ...fields }
            : {
                company_id: companyId,
                ...fields,
                // editing an untouched auto-found contact ⇒ save as a correction
                overrides_name: editing ? editing.name : null,
              },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Saving failed.");
      onSaved(
        state.mode === "add"
          ? "Contact added — it will stay on this company through re-analysis."
          : "Contact updated — your correction survives re-analysis.",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Saving failed.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.manualId) return;
    setRemoving(true);
    setErr(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.manualId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Removing failed.");
      onSaved(
        isManualRow
          ? "Contact deleted."
          : "Correction removed — the contact shows its researched data again.",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Removing failed.");
      setRemoving(false);
    }
  }

  const inputCls =
    "w-full rounded-[10px] border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted focus:border-steel";
  const labelCls = "mb-1 block text-[10.5px] font-bold uppercase tracking-[.08em] text-muted";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-card border border-line bg-card shadow-lg">
        <div className="flex items-center gap-3 border-b border-line-2 px-5 py-4">
          <h2 className="font-disp text-[16px] font-semibold text-ink">
            {state.mode === "add" ? "Add contact" : `Edit ${editing!.name}`}
          </h2>
          <span className="flex-1" />
          <button type="button" onClick={onClose} title="Close" className="text-muted hover:text-ink">
            <X size={17} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="mc-first">First name *</label>
              <input id="mc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={120} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="mc-last">Last name</label>
              <input id="mc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={120} className={inputCls} />
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls} htmlFor="mc-title">Title</label>
            <input id="mc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="VP of IT" className={inputCls} />
          </div>
          <div className="mb-3">
            <label className={labelCls} htmlFor="mc-email">Email</label>
            <input id="mc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} placeholder="name@company.com" className={inputCls} />
          </div>
          <div className="mb-1">
            <label className={labelCls} htmlFor="mc-phone">Phone</label>
            <input id="mc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={120} placeholder="+1 …" className={inputCls} />
          </div>

          {editing && !isManualRow && (
            <p className="mt-3 rounded-[10px] border border-line-2 bg-[#FBFCFD] px-3 py-2 text-[11px] leading-[1.45] text-slate">
              Your changes are saved as a correction on top of the researched contact and
              re-applied automatically after every re-analysis.
            </p>
          )}
          {err && (
            <p className="mt-3 rounded-[10px] border border-[#F3D9D9] bg-[#FDF3F3] px-3 py-2 text-[12px] text-[#B4453E]">
              {err}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line-2 px-5 py-4">
          {editing?.manualId && (
            <button
              type="button"
              onClick={remove}
              disabled={saving || removing}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 py-2 text-[12px] font-semibold text-spark transition-colors hover:border-[#e8b5ae] disabled:opacity-50"
            >
              {removing ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <Trash2 size={13} aria-hidden />
              )}
              {isManualRow ? "Delete" : "Revert to found data"}
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={saving || removing}
            className="rounded-[10px] border border-line bg-card px-3.5 py-2 text-[12.5px] font-medium text-slate transition-colors hover:border-[#cdd4de] hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || removing || firstName.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-[10px] bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
            {state.mode === "add" ? "Add contact" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
