"use client";

/** Delete a company profile with a hard confirm — destructive, no undo. */
import { deleteCompanyProfileAction } from "@/app/(shell)/settings/admin-actions";

export function DeleteProfileButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteCompanyProfileAction}
      onSubmit={(e) => {
        if (!confirm(`Delete the "${name}" profile? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-[10px] border border-line bg-card px-3.5 py-2 text-[13px] font-medium text-tier2 transition-colors hover:border-[#e5c9a0]"
      >
        Delete profile
      </button>
    </form>
  );
}
