"use client";

import { useActionState } from "react";
import { registerAction } from "./actions";

const inputCls =
  "rounded-[10px] border border-line bg-card px-3 py-2.5 text-[14px] text-ink outline-none focus:border-steel";

export function RegisterForm({ code }: { code: string }) {
  const [error, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={code} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-slate">Username</span>
        <input name="username" autoComplete="username" required className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-slate">Email (optional)</span>
        <input name="email" type="email" autoComplete="email" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-slate">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputCls}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-[10px] bg-spark-soft px-3 py-2 text-[12.5px] font-medium text-spark">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-[10px] border border-ink bg-ink px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#1b2d43] disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
