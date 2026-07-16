/** Phase 0 placeholder card — replaced screen by screen in later phases. */
export function Placeholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>{title}</span>
        <span className="h-px flex-1 bg-line-2" />
        <span className="mono normal-case tracking-normal">{phase}</span>
      </p>
      <h1 className="mb-1.5 font-disp text-[26px] font-bold tracking-[-.01em]">
        {title}
      </h1>
      <p className="max-w-[60ch] text-[13.5px] text-slate">{description}</p>
    </section>
  );
}
