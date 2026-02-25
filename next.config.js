/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // 基本优化
  swcMinify: true,
  
  // 图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // 环境变量
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

module.exports = nextConfig;