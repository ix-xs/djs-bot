import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import starlight from "@astrojs/starlight";
import { LOCALES, normalizeBase, remarkBaseLinks, withBase } from "./plugins/base-links.mjs";
import { remarkApiLinks } from "./plugins/api-links.mjs";
import { rehypeSharedHeadingIds } from "./plugins/heading-ids.mjs";
import { rehypeWrapTables } from "./plugins/wrap-tables.mjs";
import { MOVED } from "./redirects.mjs";
import { atelierDark, atelierLight } from "./src/styles/code-themes.mjs";

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

/** One group of the sidebar, its pages in reading order. */
const group = (label, fr, items, collapsed = true) => ({
  label,
  translations: { fr },
  collapsed,
  items: items.map((item) => (typeof item === "string" ? { slug: item } : item)),
});

// https://starlight.astro.build/reference/configuration/
export default defineConfig({
  site,
  base: base || "/",
  // Addresses of the previous structure, each pointing at its new home, in
  // every language.
  redirects: Object.fromEntries(
    Object.entries(MOVED).flatMap(([from, to]) => [
      [from, withBase(to, base)],
      ...LOCALES.map((code) => [`/${code}${from}`, withBase(`/${code}${to === "/" ? "/" : to}`, base)]),
    ]),
  ),
  markdown: {
    // The two plugins below are written for unified, not for Astro's default processor.
    processor: unified({
      // Names of exports in code become links to the reference, then every
      // internal link gets the language of its page and the base.
      remarkPlugins: [remarkApiLinks, [remarkBaseLinks, { base }]],
      rehypePlugins: [rehypeSharedHeadingIds, rehypeWrapTables],
    }),
  },
  integrations: [
    starlight({
      title: "djs-bot",
      // English is the original and keeps the addresses it always had; a
      // translation lives under its language code. A page that is not
      // translated yet falls back to English, with a notice.
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        fr: { label: "Français", lang: "fr" },
      },
      description:
        "Discord bots, fully typed. A TypeScript-first framework on top of discord.js: typed commands, buttons and forms, automatic intents and deferral, i18n, jobs, a store and a CLI.",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/ix-xs/djs-bot" }],
      editLink: {
        baseUrl: "https://github.com/ix-xs/djs-bot/edit/main/docs/",
      },
      head: [
        // Lets the page paint under the notch; the header pads itself back out.
        { tag: "meta", attrs: { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" } },
        // The SVG icon comes from Starlight; these two are for the browsers that want a PNG.
        { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "32x32", href: withBase("/favicon-32.png", base) } },
        { tag: "link", attrs: { rel: "apple-touch-icon", href: withBase("/apple-touch-icon.png", base) } },
        // Kept in step with the theme by the theme toggle.
        { tag: "meta", attrs: { name: "theme-color", content: "#121211" } },
      ],
      customCss: [
        "@fontsource-variable/bricolage-grotesque/opsz.css",
        "@fontsource/fragment-mono/400.css",
        "@fontsource/fragment-mono/400-italic.css",
        "./src/styles/atelier.css",
        "./src/styles/reference.css",
      ],
      components: {
        Header: "./src/components/Header.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
        LanguageSelect: "./src/components/LanguageSelect.astro",
        PageTitle: "./src/components/PageTitle.astro",
      },
      expressiveCode: {
        themes: [atelierDark, atelierLight],
        styleOverrides: {
          borderRadius: "6px",
          borderWidth: "1px",
          borderColor: "var(--at-line)",
          codeFontFamily: "var(--sl-font-mono)",
          codeFontSize: "0.84rem",
          codeLineHeight: "1.75",
          codePaddingBlock: "1.25rem",
          codePaddingInline: "1.25rem",
          uiFontFamily: "var(--sl-font-mono)",
          uiFontSize: "0.75rem",
          frames: {
            frameBoxShadowCssValue: "none",
            editorTabBarBackground: "var(--at-surface)",
            editorTabBarBorderBottomColor: "var(--at-line)",
            editorActiveTabBackground: "var(--at-surface)",
            editorActiveTabIndicatorTopColor: "transparent",
            editorActiveTabIndicatorBottomColor: "var(--at-accent)",
            terminalBackground: "var(--at-surface)",
            terminalTitlebarBackground: "var(--at-surface)",
            terminalTitlebarBorderBottomColor: "var(--at-line)",
            terminalTitlebarDotsOpacity: "0",
          },
        },
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      lastUpdated: false,
      // The guide, in reading order: first the setup, then one bot built page
      // by page, then the topics to read when they are needed.
      sidebar: [
        group("Getting started", "Pour commencer", [
          { slug: "index", label: "Introduction" },
          "start/discord-app",
          "start/installation",
        ], false),
        group("Your bot", "Votre bot", [
          "bot/configuration",
          "bot/main-file",
          "bot/first-command",
          "bot/finding-files",
          "bot/registering-commands",
          "bot/events",
          "bot/going-live",
        ], false),
        group("Commands", "Commandes", [
          "commands/slash-commands",
          "commands/options",
          "commands/subcommands",
          "commands/context-menus",
          "commands/guards",
          "commands/install-contexts",
        ]),
        group("Replying", "Répondre", [
          "basics/context",
          "basics/automatic-deferral",
          "messages/embeds-and-attachments",
          "messages/formatting",
          "messages/assets-and-voice",
          "basics/wording-and-theme",
        ]),
        group("Components", "Composants", [
          "components/buttons",
          "components/select-menus",
          "components/modals",
          "components/components-v2",
          "components/pagination",
        ]),
        group("Events and automation", "Événements et automatisations", [
          "events/events-and-intents",
          "events/triggers",
          "events/jobs",
        ]),
        group("Organising your code", "Organiser son code", [
          "basics/project-layout",
          "architecture/services",
          "architecture/plugins",
          "architecture/features",
        ]),
        group("Data", "Données", ["data/store", "data/cache", "data/i18n", "data/flags", "data/audit"]),
        group("Production", "Production", [
          { slug: "basics/configuration", label: "All the configuration", translations: { fr: "Toute la configuration" } },
          "basics/lifecycle",
          "production/deploying",
          "production/logging",
          "production/health",
          "production/presence",
          "production/resilience",
          "production/sharding",
          "production/testing",
          "recipes/hosting",
        ]),
        group("Complete examples", "Exemples complets", [
          "recipes/moderation",
          "recipes/ticket-system",
          "recipes/role-menu",
          "recipes/levelling",
        ]),
        group("Help", "Aide", ["help/troubleshooting", "help/faq", "help/glossary", "api/errors", "api/cli"]),
      ],
    }),
  ],
});
