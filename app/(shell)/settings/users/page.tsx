import { forbidden } from "next/navigation";
import { auth } from "@/auth";
import { listOpenInvites } from "@/lib/db/queries/invites";
import { getSettings } from "@/lib/db/queries/settings";
import { listUsers } from "@/lib/db/queries/users";
import {
  createInviteAction,
  revokeInviteAction,
  toggleOpenRegistrationAction,
  toggleUserActiveAction,
} from "./actions";
import { CopyInviteLink } from "./copy-invite-link";

export default async function UsersSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") forbidden();

  const [users, invites, settings] = await Promise.all([
    listUsers(),
    listOpenInvites(),
    getSettings(),
  ]);
  const openRegistration = settings?.allowOpenRegistration ?? false;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-card border border-line bg-card p-5 shadow-card">
        <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>Users</span>
          <span className="h-px flex-1 bg-line-2" />
          <span className="mono normal-case tracking-normal">{users.length}</span>
        </p>
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">All user accounts</caption>
          <thead>
            <tr className="border-b border-line text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted">
              <th className="py-2 pr-4 font-semibold">Username</th>
              <th className="py-2 pr-4 font-semibold">Email</th>
              <th className="py-2 pr-4 font-semibold">Role</th>
              <th className="py-2 pr-4 font-semibold">Status</th>
              <th className="py-2 pr-4 font-semibold">Created</th>
              <th className="py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line-2 last:border-none">
                <td className="py-2.5 pr-4 font-medium text-ink">{u.username}</td>
                <td className="py-2.5 pr-4 text-slate">{u.email ?? "—"}</td>
                <td className="py-2.5 pr-4">
                  <span className="rounded-md bg-line-2 px-2 py-0.5 font-disp text-[10.5px] font-semibold uppercase tracking-wide text-slate">
                    {u.role}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  {u.isActive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-tier1-soft px-2 py-0.5 text-[10.5px] font-bold text-tier1">
                      <span className="h-[5px] w-[5px] rounded-full bg-tier1" />
                      ACTIVE
                    </span>
                  ) : (
                    <span className="rounded-full bg-line-2 px-2 py-0.5 text-[10.5px] font-bold text-muted">
                      DISABLED
                    </span>
                  )}
                </td>
                <td className="mono py-2.5 pr-4 text-[11.5px] text-muted">
                  {u.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="py-2.5 text-right">
                  {u.id !== session.user.id && (
                    <form action={toggleUserActiveAction} className="inline">
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-line bg-card px-2.5 py-1 text-[11.5px] font-medium text-slate transition-colors hover:border-[#cdd4de] hover:text-ink"
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-card border border-line bg-card p-5 shadow-card">
        <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>Invites</span>
          <span className="h-px flex-1 bg-line-2" />
          <span className="mono normal-case tracking-normal">one-time · 7-day expiry</span>
        </p>

        <form action={createInviteAction} className="mb-4 flex items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-slate">Role for new user</span>
            <select
              name="role"
              defaultValue="member"
              className="rounded-[10px] border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none focus:border-steel"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1b2d43]"
          >
            Invite user
          </button>
        </form>

        {invites.length === 0 ? (
          <p className="text-[12.5px] text-muted">
            No open invites. Create one and send the link — it works once and expires in 7
            days.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-3 rounded-[11px] border border-line-2 px-3.5 py-2.5"
              >
                <code className="mono text-[12px] text-ink">{inv.code}</code>
                <span className="rounded-md bg-line-2 px-2 py-0.5 font-disp text-[10.5px] font-semibold uppercase tracking-wide text-slate">
                  {inv.role}
                </span>
                <span className="mono text-[11px] text-muted">
                  expires {inv.expiresAt.toISOString().slice(0, 10)}
                </span>
                <span className="flex-1" />
                <CopyInviteLink code={inv.code} />
                <form action={revokeInviteAction} className="inline">
                  <input type="hidden" name="id" value={inv.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-line bg-card px-2.5 py-1 text-[11.5px] font-medium text-tier2 transition-colors hover:border-[#cdd4de]"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-card p-5 shadow-card">
        <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>Open registration</span>
          <span className="h-px flex-1 bg-line-2" />
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <p className="max-w-[52ch] text-[12.5px] text-slate">
            {openRegistration ? (
              <span className="font-medium text-tier2">
                Open registration is ON — anyone with the URL can create an account and
                spend API credits.
              </span>
            ) : (
              <>
                Off (recommended). Anyone with the URL could create an account and spend
                API credits per run.
              </>
            )}
          </p>
          <form action={toggleOpenRegistrationAction}>
            <input type="hidden" name="enable" value={openRegistration ? "false" : "true"} />
            <button
              type="submit"
              className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-[#cdd4de]"
            >
              {openRegistration ? "Turn off" : "Turn on"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
