/** @type {import('next').NextConfig} */
const nextConfig = {
  //output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  env: {
    ALIYUN_AK_ID: process.env.ALIYUN_AK_ID,
    ALIYUN_AK_SECRET: process.env.ALIYUN_AK_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_KEY,
    NLS_APP_KEY: process.env.NLS_APP_KEY,
    WECHAT_APP_ID: process.env.WECHAT_APP_ID,
    WECHAT_APP_SECRET: process.env.WECHAT_APP_SECRET,
    SUPABASE_REDIRECT_URL: process.env.SUPABASE_REDIRECT_URL
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'ali-oss': false,
        'urllib': false,
        'vm2': false
      }
    }
    return config
  }
};

module.exports = nextConfig;
