/**
 * Edge-safe Auth.js config — imported by middleware.ts, so it must not pull in
 * pg, bcrypt, or any Node-only module. The Credentials provider (which needs
 * both) is added in auth.ts, which only runs in the Node runtime.
 */
import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login", "/register"];

export const authConfig = {
  pages: { signIn: "/login" },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7-day expiry per docs/01-ARCHITECTURE.md
  },
  trustHost: true, // Render terminates TLS in front of the service
  providers: [], // filled in by auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "admin" | "member";
      session.user.username = token.username as string;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        // already signed in → skip the login/register screens
        if (isLoggedIn) {
          return Response.redirect(new URL("/prospects", request.nextUrl));
        }
        return true;
      }
      return isLoggedIn; // false → Auth.js redirects to pages.signIn
    },
  },
} satisfies NextAuthConfig;
