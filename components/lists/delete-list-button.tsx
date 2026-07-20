"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteListButton({ listId, name }: { listId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm(`Delete "${name}"? The list is hidden, not destroyed.`)) return;
    setBusy(true);
    await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      title="Delete list (soft)"
      className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-card text-slate transition-colors hover:border-[#cdd4de] hover:text-spark disabled:opacity-50"
    >
      <Trash2 size={13} aria-hidden />
    </button>
  );
}
