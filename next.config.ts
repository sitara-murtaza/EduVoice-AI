import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const origin = process.env.CLOUDFLARE_API_URL?.replace(/\/$/, "");
    if (!origin) return [];
    if (!/^https?:\/\//.test(origin)) throw new Error("CLOUDFLARE_API_URL must be an HTTP(S) origin.");
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  },
};

export default nextConfig;
