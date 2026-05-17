/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      // Cache API responses for product search
      urlPattern: /^https?.*\/api\/products.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'product-search-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
      },
    },
    {
      // Cache static assets
      urlPattern: /^https?.*\.(png|jpg|jpeg|svg|gif|ico|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      // Cache fonts
      urlPattern: /^https?.*\.(woff|woff2|ttf|otf|eot)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'font-cache',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
    {
      // Cache page navigations
      urlPattern: /^https?.*$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'page-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 24 hours
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        stream: false,
        crypto: false,
        fs: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);
