import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.MEDIA_BUILD_DIR || ".next",
};
export default config;
