/**
 * Next.js config.
 *
 * /api/* is proxied to the backend (NEXT_PUBLIC_API_URL, default
 * http://localhost:8000) so the browser talks same-origin to the
 * frontend. That is what makes the auth refresh cookie work: it is a
 * first-party cookie on the frontend's own domain (SameSite=Lax),
 * instead of a cross-site cookie the browser would refuse to send to
 * the backend's host. Keep NEXT_PUBLIC_API_URL set wherever the
 * frontend is deployed (Vercel) — it is the proxy destination.
 *
 * @type {import('next').NextConfig}
 */
const backendUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*",
        destination: `${backendUrl}/api/:path*` },
      // The status pill calls same-origin /health (see services/api.ts
      // health()); without this rewrite Next.js would 404 it and the
      // app would always look offline.
      { source: "/health", destination: `${backendUrl}/health` },
    ];
  },
};

module.exports = nextConfig;
