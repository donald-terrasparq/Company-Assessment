import { auth } from "@/auth";
import { Rail } from "@/components/shell/rail";
import { TopBar } from "@/components/shell/top-bar";

export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const initials = (session?.user.username ?? "??").slice(0, 2).toUpperCase();

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
