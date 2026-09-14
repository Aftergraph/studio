import type { NextConfig } from 'next';

const STUDIO_API_URL = process.env.STUDIO_API_URL || 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${STUDIO_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
