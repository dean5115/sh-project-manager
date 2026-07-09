const path = require('path')
const fs = require('fs')

// Copy pdfjs worker to public/ so it can be served from same origin (avoids CORS)
try {
  const workerSrc = path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
  const workerDst = path.join(__dirname, 'public/pdf.worker.min.js')
  if (fs.existsSync(workerSrc)) fs.copyFileSync(workerSrc, workerDst)
} catch {}

const API_URL = process.env.API_URL || 'http://127.0.0.1:3002'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sitepilot/types'],
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
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
