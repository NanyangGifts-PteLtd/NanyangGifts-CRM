import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Keep build tracing inside this repository when a parent directory has an
  // unrelated package-lock.json.
  outputFileTracingRoot: path.resolve(process.cwd()),
};

export default nextConfig;
