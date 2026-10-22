import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: ["@clipwise/shared"],
};

export default config;
