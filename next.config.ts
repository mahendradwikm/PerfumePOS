import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker builds set NEXT_OUTPUT_STANDALONE=true to emit a self-contained
  // `server.js` carrying only the traced node_modules it needs. Gated behind
  // an env var so the host `npm run build` / `npm start` flow is unchanged.
  output:
    process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  // This checkout lives in a scratch folder under the user's home directory,
  // where a stray package-lock.json sits ABOVE the repo. Turbopack walks up,
  // finds that foreign lockfile and then warns on every dev/build run:
  //   "Next.js ignored package-lock.json in C:\Users\mahen ... set turbopack.root"
  // Pinning the root to this project silences it. Defaults to the repo root
  // when the variable is absent, so normal checkouts behave exactly as before.
  turbopack: {
    root: process.cwd(),
  },
  // `next dev` only. The published port is reachable from any device on the
  // same network because the compose file binds 0.0.0.0, so this list only
  // needs the dev origins a local run can be opened through. IPs change with
  // DHCP, so they are deliberately NOT hardcoded here.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.0/16",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "*.loca.lt",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
