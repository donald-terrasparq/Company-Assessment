import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-card p-8 text-center shadow-card">
        <div className="mono mb-2 text-[40px] font-bold text-tier2">403</div>
        <h1 className="mb-2 font-disp text-lg font-semibold text-ink">Admins only</h1>
        <p className="mb-6 text-[13px] text-slate">
          This page is limited to admin accounts. Ask your admin if you need access.
        </p>
        <Link
          href="/prospects"
          className="inline-flex rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
        >
          Back to prospects
        </Link>
      </div>
    </div>
  );
}
