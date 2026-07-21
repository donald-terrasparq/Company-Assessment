/**
 * Route protection (ticket 1.2): everything except /login, /register, the auth
 * endpoints, /api/health (Render's health check), and /api/apollo/webhook
 * (Apollo's async phone callback — HMAC-token gated in the route itself)
 * requires a session. The admin gate for /settings/users is enforced in that
 * page via forbidden() — middleware only decides logged-in vs. not.
 */
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/apollo/webhook|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
