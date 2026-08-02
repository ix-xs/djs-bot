import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { CATEGORIES } from "./scripts/generate.mjs";

// https://starlight.astro.build/reference/configuration/
export default defineConfig({
  site: "https://ix-xs.github.io",
  base: "/djs-bot",
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
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "index" },
            { label: "Getting started", slug: "getting-started" },
          ],
        },
        // One collapsible group per guide category (see scripts/generate.mjs).
        ...CATEGORIES.map((category) => ({
          label: category.label,
          collapsed: true,
          autogenerate: { directory: `guide/${category.slug}` },
        })),
      ],
    }),
  ],
});
