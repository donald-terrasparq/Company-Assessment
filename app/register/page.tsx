import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account — Company Assessment" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code = "" } = await searchParams;

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-card border border-line bg-card p-6 shadow-card">
          <h1 className="mb-1 font-disp text-[18px] font-semibold text-ink">
            Create your account
          </h1>
          <p className="mb-4 text-[12.5px] text-slate">
            {code
              ? "You've been invited to Company Assessment."
              : "Registration normally requires an invite link from your admin."}
          </p>
          <RegisterForm code={code} />
        </div>
      </div>
    </div>
  );
}
