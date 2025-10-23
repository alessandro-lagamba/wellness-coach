import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features
  experimental: {
    turbo: {
      // Turbopack configuration
    },
  },
  
  // API rewrites to backend (exclude TTS and Chat - handled by Next.js)
  async rewrites() {
    return [
      // Specific routes handled by Next.js API routes
      // /api/tts/* and /api/chat/* will NOT be rewritten
      
      // All other API routes go to backend
      {
        source: '/api/health',
        destination: 'http://localhost:3001/api/health',
      },
      {
        source: '/api/emotion/:path*',
        destination: 'http://localhost:3002/api/emotion/:path*',
      },
      // Add other backend routes as needed, but exclude tts and chat
    ];
  },
  
  // CORS headers for development
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

export default nextConfig;