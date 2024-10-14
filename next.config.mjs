/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.map$/, // .map 파일을 대상으로 함
      use: 'ignore-loader', // .map 파일을 무시하는 로더 사용
    });

    return config;
  },
};

export default nextConfig;
