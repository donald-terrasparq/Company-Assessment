import { auth } from "@/auth";
import { findUserById } from "@/lib/db/queries/users";
import { Rail } from "@/components/shell/rail";
import { TopBar } from "@/components/shell/top-bar";

export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  // avatar label: admins read "ADMIN"; members get First+Last initials
  let initials = (session?.user.username ?? "??").slice(0, 2).toUpperCase();
  if (session?.user.role === "admin") {
    initials = "ADMIN";
  } else if (session?.user.id) {
    const user = await findUserById(session.user.id).catch(() => undefined);
    if (user?.firstName || user?.lastName) {
      initials =
        `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || initials;
    }
  }

  return (
    <div className="flex min-h-screen">
      <Rail initials={initials} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="mx-auto w-full max-w-[1240px] px-[30px] pb-[60px] pt-[26px]">
          {children}
        </div>
      </div>
    </div>
  );
}
