import { auth } from "@/auth";
import { SettingsTabs } from "./tabs";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";

  return (
    <div>
      <SettingsTabs isAdmin={isAdmin} />
      {children}
    </div>
  );
}
