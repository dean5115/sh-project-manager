const API_URL = process.env.API_URL || 'http://127.0.0.1:3002'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sitepilot/types'],
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
    ]
  },
}

module.exports = nextConfig
