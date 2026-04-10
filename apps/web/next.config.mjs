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
};

export default nextConfig;
