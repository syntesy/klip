/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@klip/db"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  experimental: {
    turbo: {},
  },
};

export default nextConfig;
