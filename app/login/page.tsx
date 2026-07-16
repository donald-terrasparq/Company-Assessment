import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — Company Assessment" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[11px] bg-gradient-to-br from-spark to-[#ff8a5a] shadow-[0_6px_18px_rgba(255,107,74,.4)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3v18M5 8v8M19 8v8M8.5 5.5v13M15.5 5.5v13"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div className="font-disp text-[16px] font-bold text-ink">Company Assessment</div>
            <div className="text-[12px] text-muted">Prospect signal intelligence</div>
          </div>
        </div>
        <div className="rounded-card border border-line bg-card p-6 shadow-card">
          <h1 className="mb-4 font-disp text-[18px] font-semibold text-ink">Sign in</h1>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-[12px] text-muted">
          Accounts are created by your admin — ask for an invite link if you need one.
        </p>
      </div>
    </div>
  );
}
