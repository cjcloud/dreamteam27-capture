/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removing output: 'export' to enable server-side rendering and API routes
  images: {
    unoptimized: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // This will suppress all TypeScript errors during builds
    ignoreBuildErrors: true,
  },
  trailingSlash: true,
  // These options were moved out of experimental in Next.js 15.3.3
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
}

module.exports = nextConfig
