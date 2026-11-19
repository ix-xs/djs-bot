// Where the pages of the previous structures went. Every old address keeps
// working: the build writes a redirect for each entry, in every language.
// An entry may point at an address that moved again since: `final()` sends it
// straight to where the page is now, so no redirect leads to another.
const PAGES = {
  "/getting-started/": "/start/installation/",

  "/guide/basics/install-project-layout/": "/basics/project-layout/",
  "/guide/basics/the-entry-file-definebot/": "/basics/configuration/",
  "/guide/basics/lifecycle-what-happens-on-startup/": "/basics/lifecycle/",
  "/guide/basics/the-ctx-object-replies/": "/basics/context/",
  "/guide/basics/automatic-deferral/": "/basics/automatic-deferral/",
  "/guide/basics/wording-theme/": "/basics/wording-and-theme/",

  "/guide/commands/slash-commands-typed-options/": "/commands/slash-commands/",
  "/guide/commands/every-option-type/": "/commands/options/",
  "/guide/commands/subcommands-groups/": "/commands/subcommands/",
  "/guide/commands/context-menus-user-message/": "/commands/context-menus/",
  "/guide/commands/install-contexts-guild-vs-user-install/": "/commands/install-contexts/",
  "/guide/commands/guards-permissions-cooldowns-checks/": "/commands/guards/",

  "/guide/components/typed-buttons-the-customid-router/": "/components/buttons/",
  "/guide/components/select-menus/": "/components/select-menus/",
  "/guide/components/modals-text-selects-uploads-choices/": "/components/modals/",
  "/guide/components/components-v2-ui-builders/": "/components/components-v2/",
  "/guide/components/pagination-confirmation-dialogs/": "/components/pagination/",

  "/guide/messages/building-embeds/": "/messages/embeds-and-attachments/",
  "/guide/messages/attachments-images/": "/messages/embeds-and-attachments/",
  "/guide/messages/mentions-emojis-timestamps/": "/messages/formatting/",
  "/guide/messages/allowed-mentions-safe-pings/": "/messages/formatting/",
  "/guide/messages/avatars-banners-asset-urls/": "/messages/assets-and-voice/",
  "/guide/messages/voice-state-helpers/": "/messages/assets-and-voice/",

  "/guide/events/events-intent-autopilot/": "/events/events-and-intents/",
  "/guide/events/message-triggers-auto-responders/": "/events/triggers/",

  "/guide/architecture/services-dependency-injection/": "/architecture/services/",
  "/guide/architecture/scheduled-jobs/": "/events/jobs/",
  "/guide/architecture/plugins-middleware-hooks/": "/architecture/plugins/",
  "/guide/architecture/features-reusable-packs/": "/architecture/features/",

  "/guide/data/smart-cache-entity-resolution/": "/data/cache/",
  "/guide/data/internationalisation-ctx-t/": "/data/i18n/",
  "/guide/data/persistence-key-value-stores/": "/data/store/",
  "/guide/data/feature-flags-per-guild/": "/data/flags/",

  "/guide/ops/deploying-global-specific-guilds/": "/production/deploying/",
  "/guide/ops/cli-reference/": "/api/cli/",
  "/guide/ops/presence-activities/": "/production/presence/",
  "/guide/ops/sharding-scaling/": "/production/sharding/",
  "/guide/ops/resilience-rate-limits-circuit-breakers-retry/": "/production/resilience/",
  "/guide/ops/audit-trail-ctx-audit/": "/data/audit/",
  "/guide/ops/health-checks-metrics/": "/production/health/",

  "/guide/reference/error-handling-codes/": "/api/errors/",
  "/guide/reference/testing-without-discord/": "/production/testing/",

  "/api/overview/": "/reference/",
  "/api/definitions/": "/reference/",
  "/api/configuration/": "/basics/configuration/",
  "/api/context/": "/basics/context/",
  "/api/options/": "/commands/options/",
  "/api/guards/": "/commands/guards/",
  "/api/services/": "/architecture/services/",
  "/api/plugins/": "/architecture/plugins/",
  "/api/store/": "/data/store/",
  "/api/cache/": "/data/cache/",
  "/api/i18n/": "/data/i18n/",
  "/api/flags/": "/data/flags/",
  "/api/audit/": "/data/audit/",
  "/api/logger/": "/production/logging/",
  "/api/health/": "/production/health/",
  "/api/resilience/": "/production/resilience/",
  "/api/testing/": "/production/testing/",
  "/api/ui/": "/components/components-v2/",
  "/api/formatting/": "/messages/formatting/",

  // The guide rebuilt as one path (November 2026): the landing page, the
  // tutorial and the quick start became "Getting started" and "Your bot".
  "/introduction/": "/",
  "/how-it-works/": "/",
  "/quick-start/": "/start/installation/",
  "/tutorial/what-you-need/": "/start/installation/",
  "/tutorial/create-your-app/": "/start/discord-app/",
  "/tutorial/your-first-bot/": "/bot/main-file/",
  "/tutorial/commands-and-options/": "/bot/first-command/",
  "/tutorial/buttons-and-forms/": "/components/buttons/",
  "/tutorial/organising-your-bot/": "/bot/finding-files/",
  "/tutorial/going-live/": "/bot/going-live/",

  // 1.5: a plain documentation. The introduction, the guided project ("Your
  // bot") and the complete examples are gone: each address goes to the page
  // that now holds its facts. Installation is the home page, the exports page
  // is back as a generated page of the documentation.
  "/start/installation/": "/",
  "/start/discord-app/": "/",
  "/bot/configuration/": "/basics/configuration/",
  "/bot/main-file/": "/basics/lifecycle/",
  "/bot/first-command/": "/commands/slash-commands/",
  "/bot/finding-files/": "/basics/project-layout/",
  "/bot/registering-commands/": "/production/deploying/",
  "/bot/events/": "/events/events-and-intents/",
  "/bot/going-live/": "/production/hosting/",
  "/recipes/hosting/": "/production/hosting/",
  "/recipes/moderation/": "/commands/guards/",
  "/recipes/ticket-system/": "/components/buttons/",
  "/recipes/role-menu/": "/components/select-menus/",
  "/recipes/levelling/": "/data/store/",
};

/** An address that moved twice goes straight to the last one. */
const final = (to, all) => {
  const seen = new Set();
  while (all[to] && !seen.has(to)) {
    seen.add(to);
    to = all[to];
  }
  return to;
};

export const MOVED = Object.fromEntries(Object.entries(PAGES).map(([from, to]) => [from, final(to, PAGES)]));
