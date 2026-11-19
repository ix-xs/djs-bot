// The sidebar of the documentation, in reading order: installation and
// configuration, the basics, then the API one page per area, then help.
// The reference is a section of its own, from the header.
//
// `astro.config.mjs` builds Starlight's sidebar from it, and
// `scripts/api-model.mjs` orders the "All exports" page by it, so that page
// follows the sidebar without a second list to keep in step.
//
// An item is a page (its slug), or `{ slug, label, fr }` to give the page
// another name in the sidebar, or a nested group.

/** One group: its English label, its French label, its items. */
const group = (label, fr, items, collapsed = false) => ({ label, fr, collapsed, items });

export const SIDEBAR = [
  group("Getting started", "Démarrer", [
    { slug: "index", label: "Installation", fr: "Installation" },
    "basics/configuration",
  ]),
  group("Basics", "Les bases", [
    "basics/project-layout",
    "basics/lifecycle",
    "basics/context",
    "basics/automatic-deferral",
    "basics/wording-and-theme",
    "api/errors",
  ]),
  group("API", "API", [
    "api/exports",
    group("Commands", "Commandes", [
      "commands/slash-commands",
      "commands/options",
      "commands/subcommands",
      "commands/context-menus",
      "commands/guards",
      "commands/install-contexts",
    ]),
    group("Components", "Composants", [
      "components/buttons",
      "components/select-menus",
      "components/modals",
      "components/components-v2",
      "components/pagination",
    ]),
    group("Messages", "Messages", ["messages/embeds-and-attachments", "messages/formatting", "messages/assets-and-voice"]),
    group("Events and jobs", "Événements et tâches", ["events/events-and-intents", "events/triggers", "events/jobs"]),
    group("Architecture", "Architecture", ["architecture/services", "architecture/plugins", "architecture/features"]),
    group("Data", "Données", ["data/store", "data/cache", "data/i18n", "data/flags", "data/audit"]),
    group("Production", "Production", [
      "production/deploying",
      "production/hosting",
      "production/logging",
      "production/health",
      "production/presence",
      "production/resilience",
      "production/sharding",
    ]),
    group("Tooling", "Outils", ["api/cli", "production/testing"]),
  ]),
  group("Help", "Aide", ["help/upgrading", "help/troubleshooting", "help/faq", "help/glossary"], true),
];

/** Every page of the sidebar, in order: `["index", "basics/configuration", ...]`. */
export function slugsOf(items = SIDEBAR) {
  return items.flatMap((item) => (typeof item === "string" ? [item] : item.items ? slugsOf(item.items) : [item.slug]));
}

/** The sidebar as Starlight wants it. */
export function starlightSidebar(items = SIDEBAR) {
  return items.map((item) => {
    if (typeof item === "string") return { slug: item };
    if (item.items) return { label: item.label, translations: { fr: item.fr }, collapsed: item.collapsed, items: starlightSidebar(item.items) };
    return { slug: item.slug, label: item.label, translations: { fr: item.fr } };
  });
}
