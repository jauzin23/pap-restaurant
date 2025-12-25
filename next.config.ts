import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pap-imagens.s3.amazonaws.com",
        pathname: "/imagens-menu/**",
      },
    ],
  },
};

export default nextConfig;
