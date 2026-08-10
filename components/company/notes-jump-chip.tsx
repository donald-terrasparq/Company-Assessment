"use client";

/**
 * The NOTES / ADD NOTE chip in the company header. Explicitly scrolls to the
 * notes card at the bottom of the page (native #hash jumps can be swallowed
 * by the app-router's client navigation) and focuses the note box so the
 * user can type immediately.
 */
import { StickyNote } from "lucide-react";
import { NOTES_ANCHOR_ID } from "@/components/company/notes-card";
import { cn } from "@/lib/utils";

export function NotesJumpChip({ noteCount }: { noteCount: number }) {
  function jump(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const section = document.getElementById(NOTES_ANCHOR_ID);
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    section
      .querySelector<HTMLTextAreaElement>('textarea[name="body"]')
      ?.focus({ preventScroll: true });
  }

  return (
    <a
      href={`#${NOTES_ANCHOR_ID}`}
      onClick={jump}
      title={
        noteCount > 0
          ? `${noteCount} note${noteCount === 1 ? "" : "s"} — jump to the notes section`
          : "No notes yet — jump down to add one"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 font-disp text-[10.5px] font-bold tracking-[.04em] transition-colors",
        noteCount > 0
          ? "bg-note-soft text-note hover:opacity-80"
          : "border border-line text-muted hover:border-[#cdd4de] hover:text-slate",
      )}
    >
      <StickyNote size={11} aria-hidden />
      {noteCount > 0 ? `NOTES · ${noteCount}` : "ADD NOTE"}
    </a>
  );
}
