import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: false, // Use tsc for declarations instead
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: [
    "@elizaos/core",
    "ethers",
    "jose",
    "qrcode-terminal",
  ],
});
