import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Poštovní knihovny běží jen na serveru a nesmějí se sbalovat do balíčku
  serverExternalPackages: ['imapflow', 'mailparser', 'nodemailer'],
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
