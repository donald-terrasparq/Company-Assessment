"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const inputCls =
  "rounded-[10px] border border-line bg-card px-3 py-2.5 text-[14px] text-ink outline-none focus:border-steel";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-slate">Current password</span>
        <input
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-slate">New password</span>
        <input
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputCls}
        />
      </label>
      {state && (
        <p
          role="alert"
          className={
            state.ok
              ? "rounded-[10px] bg-tier1-soft px-3 py-2 text-[12.5px] font-medium text-tier1"
              : "rounded-[10px] bg-spark-soft px-3 py-2 text-[12.5px] font-medium text-spark"
          }
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-max rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1b2d43] disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
