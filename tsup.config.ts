import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  bundle: true,
  external: ["@opencode-ai/plugin", "@opencode-ai/sdk", "@opencode/plugin", "bun:sqlite"],
});
