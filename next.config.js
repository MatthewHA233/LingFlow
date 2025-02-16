/** @type {import('next').NextConfig} */
const webpack = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  // 针对浏览器扩展注入的属性，通过编译器配置移除它们
  compiler: {
    reactRemoveProperties: {
      properties: ['youmind-sidebar-open', 'youmind-extension-version']
    }
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    domains: ['localhost', '127.0.0.1'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      }
    ]
  },
  env: {
    ALIYUN_AK_ID: process.env.ALIYUN_AK_ID,
    ALIYUN_AK_SECRET: process.env.ALIYUN_AK_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NLS_APP_KEY: process.env.NLS_APP_KEY,
    WECHAT_APP_ID: process.env.WECHAT_APP_ID,
    WECHAT_APP_SECRET: process.env.WECHAT_APP_SECRET,
    SUPABASE_REDIRECT_URL: process.env.SUPABASE_REDIRECT_URL
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'original-fs': false,
        'zipfile': false,
        'coffee-script': false,
        'vm2': false,
        'bufferutil': false,
        'utf-8-validate': false,
        'urllib': false,
        'any-promise': false,
        'proxy-agent': false,
        'pac-resolver': false,
        'pac-proxy-agent': false,
        'degenerator': false,
        'osenv': false,
        'npmlog': false,
        'rimraf': false,
        'are-we-there-yet': false,
        'gauge': false,
        'inflight': false,
        'glob': false,
        'node-pre-gyp': false
      };

      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(coffee-script|bufferutil|utf-8-validate|any-promise|urllib|proxy-agent|vm2)$/
        })
      );
    }

    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
      exclude: /node_modules/,
    });

    // 忽略可选依赖的警告
    config.ignoreWarnings = [
      { module: /node_modules\/any-promise/ },
      { module: /node_modules\/vm2/ },
      { module: /node_modules\/ws/ }
    ];

    return config;
  }
};

module.exports = nextConfig;
