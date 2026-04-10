import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  bundle: true,
  // Bundle workspace packages (no pnpm symlinks at runtime)
  noExternal: [/@klip\/.*/],
  platform: "node",
  target: "node20",
  sourcemap: false,
  clean: true,
});
