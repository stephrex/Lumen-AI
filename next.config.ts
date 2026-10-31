import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Allow phone testing through VS Code dev tunnels / localtunnel in dev. */
  allowedDevOrigins: ["*.devtunnels.ms", "*.loca.lt", "*.trycloudflare.com"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
