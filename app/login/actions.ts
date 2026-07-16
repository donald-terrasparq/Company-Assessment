"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function loginAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/prospects",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return "Invalid username or password.";
    }
    throw error; // the success redirect is thrown — let Next.js handle it
  }
}
