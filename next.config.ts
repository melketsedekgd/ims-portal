import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The KPI import posts the whole .xlsx to a server action (the file is
      // parsed there and never stored). The default 1 MB is too tight for a
      // real quarterly report. There is no per-action limit, so this applies
      // to every action. Kept under proxyClientMaxBodySize (10 MB default),
      // above which proxy.ts would silently truncate the body; the parser
      // itself refuses files over 7 MB with a message.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
