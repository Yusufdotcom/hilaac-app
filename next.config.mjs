/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.supabase.co;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
