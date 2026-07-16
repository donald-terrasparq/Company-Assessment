# design/ — Visual source of truth

## `company_assessment_app.html`

This is the **approved UI prototype**. Open it in any browser — it's a single self-contained file, no
build step. It is the target the real app must match.

It contains the two core screens, fully interactive:

1. **Prospect list** — the ranked results table. Toggle at the top: **Prospect list ↔ Company detail**.
   - Left rail (Prospects · Lists · Signals · Settings), upload/context strip with the
     **"Max 100 companies per list"** label and the `79 / 100` counter.
   - Tier distribution bar, filter chips, and the stylized table populated with the seven Tier 1
     companies from the real analysis.
   - The **score-anatomy bar** — the signature element — splits every 0–100 score into a steel *Fit*
     segment and a tier-colored *Trigger* segment, with a coral pulse when the trigger is fresh.

2. **Company detail (Erlanger Health)** — click the Erlanger row or the top toggle.
   - Score ring, "Why now" hero, expanded score anatomy with the arithmetic shown, category bars,
     signal timeline (dated, sourced, confidence-rated), press cards, recommended play, top contacts
     (labeled "sample"), and a coverage/caveats panel.

## How to use it while building

`docs/04-UI-SPEC.md` is the written spec; **this file is the picture**. When they disagree about a
pixel, the spec wins on behavior and this wins on look. Claude Code should open this file, extract the
design tokens (colors, fonts, spacing, the anatomy-bar treatment), and reproduce the layout in real
React components — **not** embed this HTML. The tokens are also listed in `docs/04-UI-SPEC.md`.

Screens the prototype does **not** yet include (build them from `docs/04-UI-SPEC.md`, in the same
visual language): **Lists**, **Signals**, **Settings**, **VIEW ALL**, and the **upload modal**.

## What's illustrative vs real

- The seven Tier 1 companies, their scores, and Erlanger's signals are **real** outputs from the
  analysis — safe to use as seed/demo data.
- The **contacts are placeholders** (labeled "sample"). Never present them as real people; Phase 2
  replaces them with Apollo-verified data.
- Press snippets are **paraphrased**, not quoted — keep them that way (copyright rule in `CLAUDE.md`).
