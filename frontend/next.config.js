/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  webpack: (config, { isServer }) => {
    // Handle Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Externalize problematic packages
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // Fix @react-native-async-storage issue
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': require.resolve(
        './src/lib/asyncStorageShim.js'
      ),
    };

    return config;
  },
};

module.exports = nextConfig;