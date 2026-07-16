# 07 — What a run actually costs

## Inputs

Lists are capped at **100 companies**, so this is the worst case for a single run.

- 100 companies × 8 searches = **800 searches**
- Per company: ~15k input tokens (search snippets are bulky) + ~1.5k output tokens

## Anthropic web search path

Web search on the Claude API is **$10 per 1,000 searches**, and the retrieved content is billed as
standard input tokens on top of that.

```
searches:  800 / 1000 × $10                        = $8.00
input:     100 × 15,000  = 1.50M tokens
output:    100 ×  1,500  = 0.15M tokens
```

Token cost depends on the model — check `claude.com/pricing` for current rates rather than
hardcoding them; they change. Implement `lib/costs/rates.ts` with the rates in one place and a
comment pointing at the pricing page.

**Rough total for a full 100-company run: single-digit dollars on Sonnet, roughly 3× that on Opus.**
The 100-company cap is what makes that sentence true. It is a cost control, not just a UX choice.

## Free-tier search path (Phase 1 default)

- Brave free tier (~2,000 queries/mo) → $0 until you exceed it
- SEC EDGAR → always $0
- Search cost: **$0**. Token cost: unchanged.

So the "free" run isn't free — it's *token-only*. Say that in the UI. The Settings → Data sources
screen should show the real number next to each provider, not the word "free."

## Cost estimator (upload confirm step)

```ts
const searches   = companyCount * searchesPerCompany
const searchCost = searches * provider.costPerSearchUsd
const tokenCost  = companyCount * (AVG_IN * rates.input + AVG_OUT * rates.output)
const estimate   = searchCost + tokenCost
```

Show: `Analyze 87 companies · est. $4.60 · ~18 min`. Round up. Never start a run without this.

## Controls that actually work

1. **Monthly cap** (`settings.monthly_budget_usd`, default $100). Checked before every job claim,
   not just at run start — a runaway retry loop is exactly when you need it.
2. **Searches per company** — the biggest lever. 8 → 4 halves search cost.
3. **Sonnet by default.** Opus only for "high accuracy" runs the user opts into.
4. **Re-score is free.** Tuning weights in the Signals tab costs nothing. Encourage it.
5. **Skip the stale.** Dropping hits older than 18 months before the model call cuts input tokens.
6. **Anthropic Console spend alerts** as a backstop outside the app's own accounting.
7. **Render infra is flat** (~$21/mo for web + worker + Postgres on starter) — see `docs/09-DEPLOY-RENDER.md`.

## Timing

~30–90s per company; `WORKER_CONCURRENCY` in parallel (default 4) → roughly **15–25 minutes for a
full 100-company list** on Render's continuous worker loop. It's I/O-bound on the Claude API, not
CPU-bound, so a small always-on instance suffices; run a second `company-assessment-worker` to go faster.
Show a progress bar, stream rows in as they land, and email on completion.
