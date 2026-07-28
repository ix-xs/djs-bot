import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://starlight.astro.build/reference/configuration/
export default defineConfig({
  site: "https://ix-xs.github.io",
  base: "/djs-bot",
  integrations: [
    starlight({
      title: "djs-bot",
      description:
        "A TypeScript-first, production-ready framework for Discord bots built on discord.js.",
      social: {
        github: "https://github.com/ix-xs/djs-bot",
      },
      editLink: {
        baseUrl: "https://github.com/ix-xs/djs-bot/edit/main/docs/",
      },
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "index" },
            { label: "Getting started", slug: "getting-started" },
          ],
        },
        {
          label: "Guide",
          autogenerate: { directory: "guide" },
        },
      ],
    }),
  ],
});
