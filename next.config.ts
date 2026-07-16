import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // enables forbidden() + app/forbidden.tsx — used to 403 non-admins on /settings/users
    authInterrupts: true,
  },
};

export default nextConfig;
