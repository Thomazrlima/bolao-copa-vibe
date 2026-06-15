import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/calendario",
        destination: "/jogos",
        permanent: true,
      },
      {
        source: "/calendario/:id",
        destination: "/jogos/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
