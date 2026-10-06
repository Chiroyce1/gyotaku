import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets two local builds (say, a review build and a Lighthouse run) live
  // side by side without overwriting each other.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
