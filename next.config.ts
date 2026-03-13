import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "attachments.clickup.com",
      },
    ],
  },
};

export default nextConfig;
