import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // vinext applies this cap to every multipart POST, including the photo upload routes
      // (closet uploads, Add Clothes, try-on). Each route still enforces its own per-photo limit.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
