import { defineConfig } from "tsup";

/**
 * Two builds:
 *  - the library (dual ESM/CJS + .d.ts), tree-shakeable, discord.js kept external.
 *  - the `djs-bot` CLI (CJS with a shebang) so `npx djs-bot` works everywhere.
 */
export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      testing: "src/testing.ts",
      plugins: "src/plugins/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    // No source maps in the published package: src/ isn't shipped, so maps would
    // only bloat it (esbuild inlines the full source into them).
    sourcemap: false,
    treeshake: true,
    splitting: false,
    target: "node20",
    external: ["discord.js", "@ix-xs/node-comfort", "tsx", "tsx/esm/api"],
    outExtension({ format }) {
      return { js: format === "esm" ? ".mjs" : ".js" };
    },
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["cjs"],
    dts: false,
    clean: false,
    sourcemap: false,
    target: "node20",
    external: ["discord.js", "@ix-xs/node-comfort", "tsx", "tsx/esm/api"],
    banner: { js: "#!/usr/bin/env node" },
    outExtension() {
      return { js: ".js" };
    },
  },
]);
