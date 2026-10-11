import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { CATEGORIES } from "./scripts/generate.mjs";
import { normalizeBase, remarkBaseLinks } from "./plugins/base-links.mjs";

// Where the site is served from. Both are overridable from the environment, so
// hosting it elsewhere (a custom domain at the root, for instance) is a matter
// of setting DOCS_SITE and DOCS_BASE in the deploy workflow:
//
//   DOCS_SITE=https://docs.example.dev DOCS_BASE=/ npm run build
//
// Every internal link in the content is written root-relative and gets the base
// prepended by `remarkBaseLinks`, so nothing else needs to change.
//
// An unset or empty variable means "use the default", so the workflow can pass
// repository variables through unconditionally. Use DOCS_BASE=/ for the root.
const site = process.env.DOCS_SITE || "https://ix-xs.github.io";
const base = normalizeBase(process.env.DOCS_BASE || "/djs-bot");

// https://starlight.astro.build/reference/configuration/
export default defineConfig({
  site,
  base: base || "/",
  markdown: {
    remarkPlugins: [[remarkBaseLinks, { base }]],
  },
  integrations: [
    starlight({
      title: "djs-bot",
      description:
        "A TypeScript-first, production-ready framework for Discord bots built on discord.js. Typed commands, typed customId routing, auto intents, DI, plugins, jobs and a batteries-included CLI.",
      social: {
        github: "https://github.com/ix-xs/djs-bot",
      },
      editLink: {
        baseUrl: "https://github.com/ix-xs/djs-bot/edit/main/docs/",
      },
      customCss: ["./src/styles/discord.css"],
      components: {
        // Applies the base path to the hero's action links (see the component).
        Hero: "./src/components/Hero.astro",
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      lastUpdated: false,
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "index" },
            { label: "Quick start", slug: "getting-started" },
          ],
        },
        {
          // The guided path for newcomers: zero to a deployed bot.
          label: "Tutorial: build a bot",
          badge: { text: "Start here", variant: "success" },
          autogenerate: { directory: "tutorial" },
        },
        {
          // Task-oriented guides, one nested group per category (scripts/generate.mjs).
          label: "Guides",
          collapsed: true,
          items: CATEGORIES.map((category) => ({
            label: category.label,
            collapsed: true,
            autogenerate: { directory: `guide/${category.slug}` },
          })),
        },
        {
          // Hand-written, exhaustive reference: every export, option and error code.
          label: "API reference",
          badge: { text: "Complete", variant: "tip" },
          collapsed: true,
          autogenerate: { directory: "api" },
        },
        {
          // Full, copy-pasteable features built from the primitives.
          label: "Recipes",
          collapsed: true,
          autogenerate: { directory: "recipes" },
        },
        {
          // Troubleshooting, FAQ and vocabulary.
          label: "Help",
          collapsed: true,
          autogenerate: { directory: "help" },
        },
      ],
    }),
  ],
});
