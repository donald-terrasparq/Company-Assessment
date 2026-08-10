"use client";

/**
 * Shared notes thread on the company detail page (0015). Full-width card
 * directly above the Danger zone; the NOTES chip in the page header anchors
 * here. Notes are keyed on the company, so they survive re-analysis. Anyone
 * can add; authors (and admins) can edit or delete their notes.
 */
import { useRef, useState } from "react";
import { Loader2, Pencil, StickyNote, Trash2, X } from "lucide-react";
import {
  addNoteAction,
  deleteNoteAction,
  updateNoteAction,
} from "@/app/(shell)/company/[resultId]/actions";
import { cn } from "@/lib/utils";

export const NOTES_ANCHOR_ID = "notes";

export interface NoteItem {
  id: string;
  body: string;
  authorName: string | null;
  mine: boolean;
  createdAt: string; // ISO
  edited: boolean;
}

const NOTE_MAX = 5000;

function noteDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function NotesCard({
  companyId,
  resultId,
  notes,
  isAdmin,
}: {
  companyId: string;
  resultId: string;
  notes: NoteItem[];
  isAdmin: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // "add" | `save:${id}` | `del:${id}`
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const addFormRef = useRef<HTMLFormElement>(null);

  return (
    <section
      id={NOTES_ANCHOR_ID}
      className="mt-5 scroll-mt-5 rounded-card border border-line bg-card p-5 shadow-card"
    >
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <StickyNote size={12} aria-hidden />
          Notes
        </span>
        <span className="h-px flex-1 bg-line-2" />
        {notes.length > 0 && (
          <span className="rounded-[6px] bg-note-soft px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-note">
            {notes.length}
          </span>
        )}
      </p>

      {/* add note */}
      <form
        ref={addFormRef}
        action={async (fd) => {
          setBusy("add");
          try {
            await addNoteAction(fd);
            setDraft("");
          } finally {
            setBusy(null);
          }
        }}
      >
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="result_id" value={resultId} />
        <textarea
          name="body"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder="Add a note about this company — calls, context, next steps…"
          className="w-full resize-y rounded-[10px] border border-line bg-card px-3 py-2.5 text-[13px] leading-[1.5] text-ink outline-none placeholder:text-muted focus:border-steel"
        />
        <div className="mt-2 flex items-center gap-3">
          {draft.length > NOTE_MAX - 500 && (
            <span className="mono text-[11px] text-muted">
              {draft.length}/{NOTE_MAX}
            </span>
          )}
          <button
            type="submit"
            disabled={busy !== null || draft.trim().length === 0}
            className="ml-auto inline-flex items-center gap-2 rounded-[10px] bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy === "add" && <Loader2 size={13} className="animate-spin" aria-hidden />}
            Add note
          </button>
        </div>
      </form>

      {/* thread — newest first */}
      {notes.length > 0 && (
        <div className="mt-3 flex flex-col gap-2.5">
          {notes.map((n) => {
            const canManage = n.mine || isAdmin;
            const isEditing = editing === n.id;
            return (
              <div
                key={n.id}
                className="rounded-[10px] border border-line-2 bg-[#FBFCFD] px-3.5 py-3"
              >
                <div className="mb-1 flex items-center gap-2 text-[10.5px] text-muted">
                  <b className="font-semibold text-slate">{n.authorName ?? "Removed user"}</b>
                  <span className="mono">{noteDate(n.createdAt)}</span>
                  {n.edited && <span>· edited</span>}
                  {canManage && !isEditing && (
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit note"
                        onClick={() => {
                          setEditing(n.id);
                          setEditDraft(n.body);
                          setConfirmDelete(null);
                        }}
                        className="rounded-md p-1 text-muted transition-colors hover:bg-line-2 hover:text-ink"
                      >
                        <Pencil size={12} aria-hidden />
                      </button>
                      {confirmDelete === n.id ? (
                        <form
                          action={async (fd) => {
                            setBusy(`del:${n.id}`);
                            try {
                              await deleteNoteAction(fd);
                            } finally {
                              setBusy(null);
                              setConfirmDelete(null);
                            }
                          }}
                          className="inline-flex items-center gap-1"
                        >
                          <input type="hidden" name="note_id" value={n.id} />
                          <input type="hidden" name="result_id" value={resultId} />
                          <button
                            type="submit"
                            disabled={busy !== null}
                            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold text-spark hover:bg-spark-soft disabled:opacity-50"
                          >
                            {busy === `del:${n.id}` ? (
                              <Loader2 size={11} className="animate-spin" aria-hidden />
                            ) : (
                              "Delete?"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-md p-1 text-muted hover:bg-line-2 hover:text-ink"
                            title="Cancel"
                          >
                            <X size={11} aria-hidden />
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          title="Delete note"
                          onClick={() => setConfirmDelete(n.id)}
                          className="rounded-md p-1 text-muted transition-colors hover:bg-line-2 hover:text-spark"
                        >
                          <Trash2 size={12} aria-hidden />
                        </button>
                      )}
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <form
                    action={async (fd) => {
                      setBusy(`save:${n.id}`);
                      try {
                        await updateNoteAction(fd);
                        setEditing(null);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <input type="hidden" name="note_id" value={n.id} />
                    <input type="hidden" name="result_id" value={resultId} />
                    <textarea
                      name="body"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      maxLength={NOTE_MAX}
                      rows={3}
                      autoFocus
                      className="w-full resize-y rounded-[8px] border border-line bg-card px-2.5 py-2 text-[13px] leading-[1.5] text-ink outline-none focus:border-steel"
                    />
                    <div className="mt-1.5 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        disabled={busy !== null}
                        className="rounded-[8px] border border-line bg-card px-2.5 py-1 text-[11.5px] font-medium text-slate hover:border-[#cdd4de] hover:text-ink disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={busy !== null || editDraft.trim().length === 0}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-[8px] bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-white",
                          "transition-opacity hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        {busy === `save:${n.id}` && (
                          <Loader2 size={11} className="animate-spin" aria-hidden />
                        )}
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="whitespace-pre-wrap text-[13px] leading-[1.5] text-ink">{n.body}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
