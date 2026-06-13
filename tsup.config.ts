import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  bundle: true,
  external: ["@opencode-ai/plugin", "@opencode-ai/sdk", "bun:sqlite"],
});
