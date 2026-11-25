import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const NOINDEX_HEADER = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive",
  },
];

const NO_CACHE_NOINDEX_HEADERS = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  },
  ...NOINDEX_HEADER,
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/policies",
        destination: "/privacy",
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ]
  },
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/admin",
        headers: NO_CACHE_NOINDEX_HEADERS,
      },
      {
        source: "/admin/:path*",
        headers: NO_CACHE_NOINDEX_HEADERS,
      },
      {
        source: "/dashboard",
        headers: NO_CACHE_NOINDEX_HEADERS,
      },
      {
        source: "/dashboard/:path*",
        headers: NO_CACHE_NOINDEX_HEADERS,
      },
      {
        source: "/api/:path*",
        headers: NOINDEX_HEADER,
      },
      {
        source: "/login",
        headers: NOINDEX_HEADER,
      },
      {
        source: "/login/:path*",
        headers: NOINDEX_HEADER,
      },
      {
        source: "/auth-error",
        headers: NOINDEX_HEADER,
      },
      {
        source: "/blocked",
        headers: NOINDEX_HEADER,
      },
      {
        source: "/unauthorized",
        headers: NOINDEX_HEADER,
      },
    ]
  },
}

export default nextConfig
