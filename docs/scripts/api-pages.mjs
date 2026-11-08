/**
 * Which page of the guide explains each export of the package: the API
 * reference links every symbol to it ("Explained in the guide"), and groups
 * the symbols by the part of the guide it belongs to.
 */

/** The entry points of the package, and the file that declares each. */
export const ENTRIES = [
  { specifier: "@ix-xs/djs-bot", file: "src/index.ts", intro: { en: "The framework itself.", fr: "Le framework lui-même." } },
  { specifier: "@ix-xs/djs-bot/plugins", file: "src/plugins/index.ts", intro: { en: "The official plugins.", fr: "Les plugins officiels." } },
  {
    specifier: "@ix-xs/djs-bot/testing",
    file: "src/testing.ts",
    intro: { en: "The test harness. Import it from your tests only.", fr: "Le harnais de test. À n'importer que depuis vos tests." },
  },
];

/** Which page documents what a source file declares. */
export const PAGES = {
  "bot.ts": ["Configuration", "/basics/configuration/"],
  "config.ts": ["Configuration", "/basics/configuration/"],
  "constants.ts": ["Project layout", "/basics/project-layout/"],
  "registry.ts": ["Project layout", "/basics/project-layout/"],
  "loader.ts": ["Project layout", "/basics/project-layout/"],
  "ids.ts": ["The ctx object", "/basics/context/"],
  "context.ts": ["The ctx object", "/basics/context/"],
  "messages.ts": ["Wording and theme", "/basics/wording-and-theme/"],
  "definitions.ts": ["Slash commands", "/commands/slash-commands/"],
  "validate.ts": ["Slash commands", "/commands/slash-commands/"],
  "schema.ts": ["Options and autocomplete", "/commands/options/"],
  "guards.ts": ["Guards", "/commands/guards/"],
  "customId.ts": ["Buttons", "/components/buttons/"],
  "modal.ts": ["Modals", "/components/modals/"],
  "ui.ts": ["Components V2", "/components/components-v2/"],
  "pagination.ts": ["Pagination and confirmation", "/components/pagination/"],
  "intents.ts": ["Events and intents", "/events/events-and-intents/"],
  "scheduler.ts": ["Scheduled jobs", "/events/jobs/"],
  "container.ts": ["Services", "/architecture/services/"],
  "index.ts": ["Plugins and hooks", "/architecture/plugins/"],
  "store.ts": ["Store", "/data/store/"],
  "cache.ts": ["Cache and entity resolution", "/data/cache/"],
  "i18n.ts": ["Internationalisation", "/data/i18n/"],
  "flags.ts": ["Feature flags", "/data/flags/"],
  "audit.ts": ["Audit trail", "/data/audit/"],
  "format.ts": ["Mentions, timestamps and safe pings", "/messages/formatting/"],
  "assets.ts": ["Assets and voice", "/messages/assets-and-voice/"],
  "voice.ts": ["Assets and voice", "/messages/assets-and-voice/"],
  "deploy.ts": ["Deploying commands", "/production/deploying/"],
  "sharding.ts": ["Sharding", "/production/sharding/"],
  "health.ts": ["Health and metrics", "/production/health/"],
  "resilience.ts": ["Resilience", "/production/resilience/"],
  "logger.ts": ["Logging", "/production/logging/"],
  "testing.ts": ["Testing", "/production/testing/"],
  "errors.ts": ["Errors", "/api/errors/"],
};

/** Symbols of a shared source file that are documented on a page of their own. */
const BY_NAME = [
  [/^(subcommand|Subcommand)/, ["Subcommands", "/commands/subcommands/"]],
  [/(UserCommand|MessageCommand|InstallContext|InteractionContext)/, ["Context menus", "/commands/context-menus/"]],
  [/^(defineButton|Button)/, ["Buttons", "/components/buttons/"]],
  [/Select/, ["Select menus", "/components/select-menus/"]],
  [/^(defineModal|Modal|field|Field|InferFields)/, ["Modals", "/components/modals/"]],
  [/^(ParamCodec|ParamMap|InferParams|p|oneOf)$/, ["Buttons", "/components/buttons/"]],
  [/^(defineEvent|Event)/, ["Events and intents", "/events/events-and-intents/"]],
  [/^(defineTrigger|Trigger)/, ["Message triggers", "/events/triggers/"]],
  [/^(defineJob|Job)/, ["Scheduled jobs", "/events/jobs/"]],
  [/^(defineService|Service)/, ["Services", "/architecture/services/"]],
  [/^(definePlugin|Plugin|HookRegistrar|MiddlewareFn)/, ["Plugins and hooks", "/architecture/plugins/"]],
  [/^(defineFeature|Feature)/, ["Features", "/architecture/features/"]],
  [/^(Autocomplete|toAutocompleteChoices|NormalizedChoices)/, ["Options and autocomplete", "/commands/options/"]],
  [/^(DeferOption|ResolvedDefer|resolveDefer)/, ["Automatic deferral", "/basics/automatic-deferral/"]],
  [/^(BotError|ERROR_CATALOGUE|ErrorCode)/, ["Errors", "/api/errors/"]],
  [/^(env|loadEnvFile)$/, ["Configuration", "/basics/configuration/"]],
  [/^(Theme|DEFAULT_THEME)$/, ["Wording and theme", "/basics/wording-and-theme/"]],
];

export function pageFor(name, file) {
  if (file === "definitions.ts" || file === "schema.ts" || file === "context.ts" || file === "config.ts" || file === "messages.ts" || file === "errors.ts") {
    for (const [pattern, page] of BY_NAME) if (pattern.test(name)) return page;
  }
  return PAGES[file];
}
