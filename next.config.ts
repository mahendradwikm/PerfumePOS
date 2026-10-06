import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.100.121",
    "localhost",
    "*.loca.lt",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
