import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "mod.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  outDir: "dist",
  splitting: false,
  clean: true,
  treeshake: true,
  minify: false,
});
