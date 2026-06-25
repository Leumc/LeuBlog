/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // 本地磁盘上传的图片由 /uploads 静态目录提供，无需远程优化
    remotePatterns: [],
  },
  // rehype-pretty-code / shiki 等 ESM 包在服务端打包
  serverExternalPackages: ["shiki"],
};

export default nextConfig;
