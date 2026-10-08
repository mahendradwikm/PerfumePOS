import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker builds set NEXT_OUTPUT_STANDALONE=true to emit a self-contained
  // `server.js` carrying only the traced node_modules it needs. Gated behind
  // an env var so the host `npm run build` / `npm start` flow is unchanged.
  output:
    process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  allowedDevOrigins: [
    "192.168.100.121",
    "localhost",
    "*.loca.lt",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
