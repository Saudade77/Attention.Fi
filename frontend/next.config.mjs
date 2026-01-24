/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false 
    };
    
    // 告诉 webpack 忽略这些模块（它们是 React Native 用的，网页不需要）
    config.externals.push(
      'pino-pretty',
      'lokijs',
      'encoding',
      '@react-native-async-storage/async-storage'
    );
    
    return config;
  },
};

export default nextConfig;