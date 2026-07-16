import { auth } from "@/auth";
import { ChangePasswordForm } from "./change-password-form";
import { signOutAction } from "./actions";

export default async function AccountSettingsPage() {
  const session = await auth();
  const user = session!.user;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-card border border-line bg-card p-5 shadow-card">
        <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>Account</span>
          <span className="h-px flex-1 bg-line-2" />
        </p>
        <dl className="grid max-w-md grid-cols-[120px_1fr] gap-y-2 text-[13.5px]">
          <dt className="text-slate">Username</dt>
          <dd className="font-medium text-ink">{user.username}</dd>
          <dt className="text-slate">Email</dt>
          <dd className="font-medium text-ink">{user.email ?? "—"}</dd>
          <dt className="text-slate">Role</dt>
          <dd>
            <span className="rounded-md bg-line-2 px-2 py-0.5 font-disp text-[11px] font-semibold uppercase tracking-wide text-slate">
              {user.role}
            </span>
          </dd>
        </dl>
      </section>

      <section className="rounded-card border border-line bg-card p-5 shadow-card">
        <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>Change password</span>
          <span className="h-px flex-1 bg-line-2" />
        </p>
        <ChangePasswordForm />
      </section>

      <section className="rounded-card border border-line bg-card p-5 shadow-card">
        <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>Session</span>
          <span className="h-px flex-1 bg-line-2" />
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-[#cdd4de]"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
