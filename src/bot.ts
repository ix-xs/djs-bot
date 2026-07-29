/**
 * The Bot orchestrator: discovery → validation → DI → connect → route → drain.
 *
 * A single {@link Bot} instance ties together the registry, the DI container,
 * intent autopilot, the interaction router (with per-interaction error
 * boundaries), plugins, jobs and graceful shutdown.
 *
 * @module bot
 */
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type AnySelectMenuInteraction,
  type ChatInputCommandInteraction,
  type ClientEvents,
  type GuildMember,
  type Interaction,
  type RepliableInteraction,
  type TextBasedChannel,
} from "discord.js";
import comfort from "@ix-xs/node-comfort";
import { createLogger, type Logger } from "./logger.js";
import { Registry, type Registrable } from "./registry.js";
import { Container } from "./container.js";
import { computeIntents, type ComputedIntents } from "./intents.js";
import { isShardChild, launchShardManager, normalizeSharding } from "./sharding.js";
import { loadFromDirectory } from "./loader.js";
import {
  deployCommands,
  planDeployment,
  clearCommands as clearScope,
  type DeployResult,
  type DeployTargetResult,
} from "./deploy.js";
import { Scheduler } from "./scheduler.js";
import { BotError } from "./errors.js";
import { customIdKey, decodeCustomId } from "./customId.js";
import {
  createReply,
  createUpdate,
  type BaseContext,
  type ButtonContext,
  type CommandContext,
  type ModalContext,
  type SelectMenuContext,
} from "./context.js";
import { env, type BotConfig, type FeatureSource } from "./config.js";
import { createI18n, type I18n } from "./i18n.js";
import { createAuditLog, type AuditLog } from "./audit.js";
import { createFeatureFlags } from "./flags.js";
import { startHealthServer } from "./health.js";
import type { OptionMap } from "./schema.js";
import type { Server } from "node:http";
import type {
  EventContext,
  HookRegistrar,
  JobContext,
  MiddlewareFn,
  PluginApp,
  PluginDefinition,
} from "./definitions.js";

/** Options for {@link Bot.deploy}. */
export interface DeployCallOptions {
  /** Force **every** command onto this single guild (ignores per-command scoping). */
  guildId?: string;
  /** Compute the diff without pushing. */
  dryRun?: boolean;
}

/** A structured description of everything the bot has loaded. */
export interface BotDescription {
  intents: string[];
  partials: string[];
  privilegedIntents: string[];
  commands: string[];
  userCommands: string[];
  messageCommands: string[];
  buttons: string[];
  selectMenus: string[];
  modals: string[];
  events: string[];
  triggers: string[];
  jobs: string[];
  services: string[];
  plugins: string[];
  features: string[];
  /** Deployment plan: command names deployed globally, and per guild id. */
  deployment: { global: string[]; guilds: Record<string, string[]> };
}

/**
 * A cross-realm brand. Because the CLI is CJS and user code is usually ESM, the
 * two load different copies of this module, so `instanceof Bot` is unreliable.
 * A registered symbol is shared across realms and survives the dual-package
 * boundary - see {@link isBot}.
 */
const BOT_BRAND: unique symbol = Symbol.for("djsbot.bot") as never;

/**
 * The bot application. Create one with {@link defineBot}.
 */
export class Bot {
  /** Cross-realm brand used by {@link isBot}. */
  public readonly [BOT_BRAND] = true;

  /** The central registry of every definition. */
  public readonly registry = new Registry();
  /** The DI container. */
  public readonly container = new Container();
  /** The root logger. */
  public readonly logger: Logger;
  /** The framework configuration. */
  public readonly config: BotConfig;

  private _client?: Client<true>;
  private scheduler?: Scheduler;
  private computed?: ComputedIntents;
  private loaded = false;
  private sharded = false;
  private presenceTimer?: NodeJS.Timeout;
  private i18n?: I18n;
  private auditLog?: AuditLog;
  private healthServer?: Server;
  private readonly metrics = { interactions: 0, errors: 0, commands: 0, startedAt: Date.now() };
  private readonly pending: Registrable[] = [];

  private readonly middlewares: MiddlewareFn[] = [];
  private readonly afterHooks: Array<(ctx: BaseContext) => unknown> = [];
  private readonly errorHooks: Array<(error: unknown, ctx?: BaseContext) => unknown> = [];
  private readonly readyHooks: Array<(client: Client<true>) => unknown> = [];
  private readonly shutdownHooks: Array<() => unknown> = [];

  public constructor(config: BotConfig) {
    this.config = config;
    this.logger = createLogger(config.logger);
  }

  /** The connected discord.js client. Throws if the bot has not started. */
  public get client(): Client<true> {
    if (!this._client) throw new Error("Bot has not started yet - call bot.start() first.");
    return this._client;
  }

  /** Registers additional definitions explicitly (in addition to `config.features`). */
  public use(...items: Registrable[]): this {
    this.pending.push(...items);
    return this;
  }

  /* ----------------------------- loading ------------------------------- */

  /**
   * Discovers features, registers everything, wires plugins, resolves services
   * and computes intents. Idempotent. Called automatically by {@link start}.
   */
  public async load(): Promise<void> {
    if (this.loaded) return;

    const registrables = await this.collectRegistrables();
    this.registry.addAll(registrables);
    for (const plugin of this.config.plugins ?? []) this.registry.add(plugin);

    for (const service of this.registry.services) this.container.register(service);
    if (this.config.store) this.container.registerValue("store", this.config.store);
    if (this.config.i18n) this.i18n = createI18n(this.config.i18n);
    if (this.config.audit) {
      this.auditLog = createAuditLog(this.config.audit);
      this.container.registerValue("audit", this.auditLog);
    }
    if (this.config.flags) {
      this.container.registerValue("flags", createFeatureFlags(this.config.flags));
    }

    this.validateContracts();
    await this.runPluginSetup();
    await this.container.resolveAll();

    this.computed = this.resolveIntents();
    this.loaded = true;
    this.logger.debug(this.registry.summary(), "Registry loaded");
  }

  private async collectRegistrables(): Promise<Registrable[]> {
    const sources: FeatureSource[] = [];
    const cfg = this.config.features;
    if (Array.isArray(cfg)) sources.push(...(cfg as FeatureSource[]));
    else if (cfg !== undefined) sources.push(cfg);

    const items: Registrable[] = [...this.pending];
    for (const source of sources) {
      if (typeof source === "string") {
        const loaded = await loadFromDirectory(source);
        for (const { item } of loaded) items.push(item);
      } else if (Array.isArray(source)) {
        items.push(...source);
      } else {
        items.push(source);
      }
    }
    return items;
  }

  private validateContracts(): void {
    const provided = new Set<string>();
    for (const service of this.registry.services) provided.add(service.name);
    for (const plugin of this.registry.plugins) plugin.provides.forEach((c) => provided.add(c));
    for (const feature of this.registry.features) feature.provides.forEach((c) => provided.add(c));
    // Config-provided services (store/audit/flags) and any value a plugin
    // registered are real capabilities too - they live in the container, not in
    // `registry.services`, so consult it as well.
    const isProvided = (need: string): boolean => provided.has(need) || this.container.has(need);

    for (const feature of this.registry.features) {
      for (const need of feature.requires) {
        if (!isProvided(need)) {
          throw new BotError("DJSBOT_E040", { detail: `feature "${feature.name}" requires "${need}"` });
        }
      }
    }
    for (const plugin of this.registry.plugins) {
      for (const need of plugin.requires) {
        if (!isProvided(need)) {
          throw new BotError("DJSBOT_E040", { detail: `plugin "${plugin.name}" requires "${need}"` });
        }
      }
      for (const conflict of plugin.conflicts) {
        if (provided.has(conflict)) {
          throw new BotError("DJSBOT_E041", { detail: `plugin "${plugin.name}" conflicts with "${conflict}"` });
        }
      }
    }
  }

  private hookRegistrar(): HookRegistrar {
    return {
      beforeInteraction: (fn) => this.middlewares.push(fn),
      afterInteraction: (fn) => this.afterHooks.push(fn),
      onError: (fn) => this.errorHooks.push(fn),
      onReady: (fn) => this.readyHooks.push(fn),
      onShutdown: (fn) => this.shutdownHooks.push(fn),
    };
  }

  private async runPluginSetup(): Promise<void> {
    for (const plugin of this.registry.plugins) {
      const app: PluginApp = {
        logger: this.logger.child({ plugin: plugin.name }),
        hooks: this.hookRegistrar(),
        config: {},
        services: {
          register: (token, value) => this.container.registerValue(token, value),
          has: (token) => this.container.has(token),
        },
      };
      await plugin.setup(app);
      this.logger.debug({ plugin: plugin.name, version: plugin.version }, "Plugin loaded");
    }
  }

  private resolveIntents(): ComputedIntents {
    if (this.config.intents && this.config.intents !== "auto") {
      return {
        intents: this.config.intents,
        partials: this.config.partials ?? [],
        privileged: [],
      };
    }
    const computed = computeIntents(this.registry.events, {
      hasTriggers: this.registry.triggers.length > 0,
    });
    if (this.config.partials) {
      computed.partials = [...new Set([...computed.partials, ...this.config.partials])];
    }
    if (computed.privileged.length > 0) {
      this.logger.warn(
        { privileged: computed.privileged },
        "Auto-enabled privileged intents - enable them in the Developer Portal",
      );
    }
    return computed;
  }

  /* ----------------------------- lifecycle ----------------------------- */

  /**
   * Loads (if needed), connects to Discord, wires the router, starts jobs and
   * installs graceful shutdown. Safe to call once; further calls are no-ops.
   *
   * When run under the CLI in introspection mode (`DJSBOT_CLI=introspect`) it
   * only loads and returns without connecting.
   */
  public async start(): Promise<void> {
    if (this._client) return;
    await this.load();

    if (process.env.DJSBOT_CLI === "introspect") {
      this.logger.debug({}, "CLI introspection - not connecting");
      return;
    }

    const token = this.config.token ?? env("DISCORD_TOKEN");

    // If sharding is enabled and we're the manager process (not a spawned
    // shard), launch the ShardingManager and stop - children run the bot.
    if (this.config.sharding && !isShardChild()) {
      this.sharded = true;
      await launchShardManager(process.argv[1] ?? "", token, normalizeSharding(this.config.sharding), this.logger);
      return;
    }

    const computed = this.computed!;

    const client = new Client({
      intents: computed.intents,
      partials: computed.partials,
      presence: this.config.presence,
    }) as Client<true>;
    this._client = client;

    this.attachEvents(client);
    this.attachTriggers(client);
    client.on(Events.InteractionCreate, (interaction) => void this.handleInteraction(interaction));
    client.once(Events.ClientReady, (ready) => void this.onReady(ready));

    this.installSignals();
    await client.login(token);
  }

  private attachEvents(client: Client<true>): void {
    for (const def of this.registry.events) {
      const context: EventContext = {
        client,
        services: this.container.view(),
        logger: this.logger.child({ event: def.event }),
      };
      const listener = (...args: unknown[]) =>
        void Promise.resolve(
          (def.run as (...a: unknown[]) => unknown)(...args, context),
        ).catch((error) => this.logger.error({ err: error, event: def.event }, "Event handler failed"));
      if (def.once) client.once(def.event as keyof ClientEvents, listener as never);
      else client.on(def.event as keyof ClientEvents, listener as never);
    }
  }

  private attachTriggers(client: Client<true>): void {
    const triggers = this.registry.triggers;
    if (triggers.length === 0) return;

    const cooldowns = new Map<string, Map<string, number>>();
    for (const t of triggers) cooldowns.set(t.name, new Map());

    client.on(Events.MessageCreate, (message) => {
      void this.handleTriggers(message, triggers, cooldowns);
    });
  }

  private async handleTriggers(
    message: import("discord.js").Message,
    triggers: readonly import("./definitions.js").TriggerDefinition[],
    cooldowns: Map<string, Map<string, number>>,
  ): Promise<void> {
    for (const trigger of triggers) {
      try {
        if (trigger.ignoreBots && message.author.bot) continue;
        const match = matchTrigger(trigger, message);
        if (!match) continue;

        if (trigger.cooldown) {
          const ms = typeof trigger.cooldown === "number"
            ? trigger.cooldown
            : (comfort.time.parseDuration(trigger.cooldown) ?? 0);
          const map = cooldowns.get(trigger.name)!;
          const until = map.get(message.author.id) ?? 0;
          if (Date.now() < until) continue;
          map.set(message.author.id, Date.now() + ms);
        }

        const correlationId = comfort.id.nano(10);
        const ctx = {
          message,
          client: this.client,
          author: message.author,
          member: message.member,
          guild: message.guild,
          channel: message.channel,
          services: this.container.view(),
          logger: this.logger.child({ trigger: trigger.name, correlationId }),
          match: match === true ? null : match,
          reply: (content: unknown) => message.reply(content as never),
          send: (content: unknown) => (message.channel as { send: (c: unknown) => Promise<unknown> }).send(content),
        };
        await trigger.run(ctx as never);
      } catch (error) {
        this.logger.error({ err: error, trigger: trigger.name }, "Trigger handler failed");
      }
    }
  }

  private async onReady(client: Client<true>): Promise<void> {
    this.logger.info({ user: client.user.tag, guilds: client.guilds.cache.size }, "Ready");

    for (const hook of this.readyHooks) {
      try {
        await hook(client);
      } catch (error) {
        this.logger.error({ err: error }, "onReady hook failed");
      }
    }

    this.startScheduler(client);
    this.startPresenceRotation(client);
    this.startHealth(client);
    await this.maybeAutoDeploy(client);
  }

  private startHealth(client: Client<true>): void {
    if (this.config.health === undefined) return;
    const options = typeof this.config.health === "number" ? { port: this.config.health } : this.config.health;
    this.healthServer = startHealthServer(
      () => ({
        ready: client.isReady(),
        uptimeMs: Date.now() - this.metrics.startedAt,
        metrics: {
          interactions: this.metrics.interactions,
          commands: this.metrics.commands,
          errors: this.metrics.errors,
          guilds: client.guilds.cache.size,
        },
        shard: client.shard ? { id: client.shard.ids[0] ?? 0, count: client.shard.count } : undefined,
      }),
      options,
    );
    this.logger.info({ port: options.port ?? 3000 }, "Health server listening");
  }

  private startPresenceRotation(client: Client<true>): void {
    const rotation = this.config.presenceRotation;
    if (!rotation || rotation.items.length === 0) return;
    const intervalMs =
      typeof rotation.interval === "number"
        ? rotation.interval
        : (comfort.time.parseDuration(rotation.interval) ?? 60_000);

    let index = 0;
    const apply = () => {
      client.user.setPresence(rotation.items[index % rotation.items.length]!);
      index++;
    };
    apply();
    this.presenceTimer = setInterval(apply, intervalMs);
    this.presenceTimer.unref?.();
  }

  /** Updates the bot's gateway presence at runtime. */
  public setPresence(presence: import("discord.js").PresenceData): void {
    this.client.user.setPresence(presence);
  }

  /** Shortcut to set a single activity (e.g. `setActivity("/help", { type: ActivityType.Watching })`). */
  public setActivity(
    name: string,
    options: { type?: import("discord.js").ActivityType; url?: string; status?: import("discord.js").PresenceStatusData } = {},
  ): void {
    this.client.user.setPresence({
      activities: [{ name, type: options.type, url: options.url }],
      status: options.status,
    });
  }

  private startScheduler(client: Client<true>): void {
    if (this.registry.jobs.length === 0) return;
    this.scheduler = new Scheduler(
      this.registry.jobs,
      (job, signal): JobContext => ({
        client,
        services: this.container.view(),
        logger: this.logger.child({ job: job.name }),
        signal,
      }),
      this.logger,
    );
    this.scheduler.start();
    this.logger.debug({ jobs: this.registry.jobs.length }, "Scheduler started");
  }

  private async maybeAutoDeploy(client: Client<true>): Promise<void> {
    const dev = process.env.NODE_ENV !== "production";
    const auto = this.config.deploy?.autoDeploy ?? dev;
    if (!auto) return;

    const token = this.config.token ?? env.optional("DISCORD_TOKEN");
    if (!token) return;
    const clientId = this.config.clientId ?? env.optional("DISCORD_CLIENT_ID") ?? client.application.id;
    const devGuildId = this.config.deploy?.devGuildId ?? env.optional("DISCORD_DEV_GUILD");
    // In development with a dev guild, mirror everything there for instant
    // testing; otherwise reconcile the real plan (global + per-command guilds).
    const guildId = dev && devGuildId ? devGuildId : undefined;

    try {
      await deployCommands(this.registry, { token, clientId, guildId, logger: this.logger });
    } catch (error) {
      this.logger.error({ err: error }, "Auto-deploy failed");
    }
  }

  private installSignals(): void {
    comfort.utils
      .dontCrash()
      .on("sig", async () => {
        this.logger.info({}, "Signal received - shutting down");
        await this.shutdown();
        process.exit(0);
      })
      .on("error", (error: unknown) => {
        this.logger.error({ err: error }, "Uncaught error (kept alive)");
        for (const hook of this.errorHooks) {
          try {
            void hook(error);
          } catch {
            /* ignore */
          }
        }
      });
  }

  /**
   * Deploys application commands, diffing against Discord first.
   *
   * By default it honours per-command scoping: commands with no `guilds` go
   * global, commands with `guilds` go to those guilds. Pass `guildId` to instead
   * force **every** command onto one guild (fast local testing).
   *
   * @example await bot.deploy();                    // production: global + per-guild
   * @example await bot.deploy({ guildId: devId });  // everything on one guild
   * @example await bot.deploy({ dryRun: true });    // preview the plan
   */
  public async deploy(options: DeployCallOptions = {}): Promise<DeployResult> {
    await this.load();
    const token = this.config.token ?? env("DISCORD_TOKEN");
    const clientId = this.config.clientId ?? env("DISCORD_CLIENT_ID");

    // Track which guilds we've deployed to, so guilds you stop targeting get
    // their commands auto-pruned on the next deploy.
    const knownGuilds = options.guildId ? [] : this.readDeployState();
    const result = await deployCommands(this.registry, {
      token,
      clientId,
      guildId: options.guildId,
      knownGuilds,
      dryRun: options.dryRun,
      logger: this.logger,
    });
    if (!options.dryRun && !options.guildId) this.writeDeployState(result.deployedGuilds);
    return result;
  }

  /**
   * Removes **all** of the app's commands from one scope. Pass a `guildId` to
   * wipe that guild, or omit it to wipe the **global** commands.
   * @example await bot.clear({ guildId: "123..." });
   */
  public async clear(options: { guildId?: string; dryRun?: boolean } = {}): Promise<DeployTargetResult> {
    await this.load();
    const token = this.config.token ?? env("DISCORD_TOKEN");
    const clientId = this.config.clientId ?? env("DISCORD_CLIENT_ID");
    return clearScope({ token, clientId, guildId: options.guildId, dryRun: options.dryRun, logger: this.logger });
  }

  private readonly deployStatePath = ".djs-bot/deploy-state.json";
  private readDeployState(): string[] {
    const state = comfort.fs.readJSON<{ guilds?: string[] }>(this.deployStatePath, { guilds: [] });
    return Array.isArray(state?.guilds) ? state.guilds : [];
  }
  private writeDeployState(guilds: string[]): void {
    try {
      comfort.fs.writeJSON(this.deployStatePath, { guilds }, { force: true });
    } catch {
      /* state tracking is best-effort */
    }
  }

  /** Gracefully drains jobs, tears down plugins and disconnects. */
  public async shutdown(): Promise<void> {
    this.scheduler?.stop();
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    this.healthServer?.close();
    for (const hook of this.shutdownHooks) {
      try {
        await hook();
      } catch (error) {
        this.logger.error({ err: error }, "onShutdown hook failed");
      }
    }
    for (const plugin of this.registry.plugins) {
      if (!plugin.teardown) continue;
      try {
        await plugin.teardown({
          logger: this.logger.child({ plugin: plugin.name }),
          hooks: this.hookRegistrar(),
          config: {},
          services: {
            register: (t, v) => this.container.registerValue(t, v),
            has: (t) => this.container.has(t),
          },
        });
      } catch (error) {
        this.logger.error({ err: error, plugin: plugin.name }, "Plugin teardown failed");
      }
    }
    if (this._client) {
      await this._client.destroy();
      this._client = undefined;
    }
    this.logger.info({}, "Shutdown complete");
  }

  /** A structured, inspectable description for `djs-bot explain`. */
  public async describe(): Promise<BotDescription> {
    await this.load();
    const c = this.computed!;
    return {
      intents: c.intents.map((i) => GatewayIntentBits[i] ?? String(i)),
      partials: c.partials.map((p) => Partials[p] ?? String(p)),
      privilegedIntents: c.privileged,
      commands: [...this.registry.commands.keys()],
      userCommands: [...this.registry.userCommands.keys()],
      messageCommands: [...this.registry.messageCommands.keys()],
      buttons: [...this.registry.buttons.keys()],
      selectMenus: [...this.registry.selectMenus.keys()],
      modals: [...this.registry.modals.keys()],
      events: this.registry.events.map((e) => e.event),
      triggers: this.registry.triggers.map((t) => t.name),
      jobs: this.registry.jobs.map((j) => `${j.name} (${j.schedule})`),
      services: this.container.tokens(),
      plugins: this.registry.plugins.map((p) => `${p.name}@${p.version ?? "0.0.0"}`),
      features: this.registry.features.map((f) => f.name),
      deployment: this.deploymentSummary(),
    };
  }

  private deploymentSummary(): { global: string[]; guilds: Record<string, string[]> } {
    const plan = planDeployment(this.registry);
    const names = (list: Array<{ name?: string }>) => list.map((c) => c.name ?? "?");
    const guilds: Record<string, string[]> = {};
    for (const [guildId, cmds] of plan.guilds) guilds[guildId] = names(cmds);
    return { global: names(plan.global), guilds };
  }

  /* ------------------------------ routing ------------------------------ */

  private async handleInteraction(interaction: Interaction): Promise<void> {
    const correlationId = comfort.id.nano(10);
    this.metrics.interactions++;
    try {
      if (interaction.isChatInputCommand()) await this.routeCommand(interaction, correlationId);
      else if (interaction.isAutocomplete()) await this.routeAutocomplete(interaction, correlationId);
      else if (interaction.isUserContextMenuCommand()) await this.routeUserCommand(interaction, correlationId);
      else if (interaction.isMessageContextMenuCommand()) await this.routeMessageCommand(interaction, correlationId);
      else if (interaction.isButton()) await this.routeButton(interaction, correlationId);
      else if (interaction.isAnySelectMenu()) await this.routeSelect(interaction, correlationId);
      else if (interaction.isModalSubmit()) await this.routeModal(interaction, correlationId);
    } catch (error) {
      this.logger.error({ err: error, correlationId }, "Interaction routing failed");
    }
  }

  private baseContext(interaction: RepliableInteraction, correlationId: string): BaseContext {
    const locale = interaction.locale ?? this.i18n?.defaultLocale ?? "en";
    const i18n = this.i18n;
    return {
      client: this.client,
      interaction,
      user: interaction.user,
      guild: interaction.guild,
      guildId: interaction.guildId,
      channel: interaction.channel as TextBasedChannel | null,
      member: (interaction.member as GuildMember | null) ?? null,
      services: this.container.view(),
      logger: this.logger.child({ correlationId, userId: interaction.user.id }),
      correlationId,
      locale,
      t: (key, vars) => (i18n ? i18n.t(locale, key, vars) : key),
      audit: async (action, details) => {
        if (!this.auditLog) return;
        await this.auditLog.record(action, {
          actorId: interaction.user.id,
          guildId: interaction.guildId,
          targetId: details?.targetId,
          metadata: details?.metadata,
        });
      },
      reply: createReply(interaction),
    };
  }

  private async routeCommand(interaction: ChatInputCommandInteraction, cid: string): Promise<void> {
    const base = this.baseContext(interaction, cid);
    const command = this.registry.commands.get(interaction.commandName);
    if (!command) {
      await base.reply.error("Unknown command.");
      return;
    }
    this.metrics.commands++;
    if (this.auditLog && this.config.audit?.autoRecordCommands) {
      void this.auditLog.record(`command:${command.name}`, {
        actorId: interaction.user.id,
        guildId: interaction.guildId,
      });
    }

    // Resolve a subcommand (optionally within a group) if the command uses them.
    if (command.subcommands || command.groups) {
      const groupName = interaction.options.getSubcommandGroup(false);
      const subName = interaction.options.getSubcommand(false);
      const sub = groupName
        ? command.groups?.[groupName]?.subcommands[subName ?? ""]
        : subName
          ? command.subcommands?.[subName]
          : undefined;
      if (!sub) {
        await base.reply.error("Unknown subcommand.");
        return;
      }
      const options = resolveOptions(sub.options, interaction);
      const ctx = { ...base, options } as unknown as CommandContext<Record<string, unknown>>;
      await this.runWithBoundary(ctx, [...command.guards, ...sub.guards], () => sub.run(ctx as never));
      return;
    }

    const options = resolveOptions(command.options, interaction);
    const ctx = { ...base, options } as unknown as CommandContext<Record<string, unknown>>;
    await this.runWithBoundary(ctx, command.guards, () => command.run?.(ctx as never));
  }

  private async routeAutocomplete(
    interaction: import("discord.js").AutocompleteInteraction,
    cid: string,
  ): Promise<void> {
    const command = this.registry.commands.get(interaction.commandName);
    if (!command) return void (await interaction.respond([]));

    let optionMap: OptionMap = command.options;
    if (command.subcommands || command.groups) {
      const groupName = interaction.options.getSubcommandGroup(false);
      const subName = interaction.options.getSubcommand(false);
      const sub = groupName
        ? command.groups?.[groupName]?.subcommands[subName ?? ""]
        : subName
          ? command.subcommands?.[subName]
          : undefined;
      optionMap = sub?.options ?? {};
    }

    const focused = interaction.options.getFocused(true);
    const handler = optionMap[focused.name]?.config.autocomplete;
    if (typeof handler !== "function") return void (await interaction.respond([]));

    try {
      const ctx = {
        interaction,
        client: this.client,
        user: interaction.user,
        guild: interaction.guild,
        services: this.container.view(),
        logger: this.logger.child({ correlationId: cid, autocomplete: focused.name }),
        focused: focused.name,
        value: String(focused.value ?? ""),
      };
      const result = await (handler as (c: unknown) => unknown)(ctx);
      await interaction.respond(normalizeChoices(result).slice(0, 25));
    } catch (error) {
      this.logger.error({ err: error, correlationId: cid }, "Autocomplete handler failed");
      try {
        await interaction.respond([]);
      } catch {
        /* interaction may have expired */
      }
    }
  }

  private async routeUserCommand(
    interaction: import("discord.js").UserContextMenuCommandInteraction,
    cid: string,
  ): Promise<void> {
    const base = this.baseContext(interaction, cid);
    const command = this.registry.userCommands.get(interaction.commandName);
    if (!command) {
      await base.reply.error("Unknown command.");
      return;
    }
    const ctx = {
      ...base,
      targetUser: interaction.targetUser,
      targetMember: (interaction.targetMember as GuildMember | null) ?? null,
    } as unknown as BaseContext;
    await this.runWithBoundary(ctx, command.guards, () => command.run(ctx as never));
  }

  private async routeMessageCommand(
    interaction: import("discord.js").MessageContextMenuCommandInteraction,
    cid: string,
  ): Promise<void> {
    const base = this.baseContext(interaction, cid);
    const command = this.registry.messageCommands.get(interaction.commandName);
    if (!command) {
      await base.reply.error("Unknown command.");
      return;
    }
    const ctx = { ...base, targetMessage: interaction.targetMessage } as unknown as BaseContext;
    await this.runWithBoundary(ctx, command.guards, () => command.run(ctx as never));
  }

  private async routeButton(interaction: Parameters<typeof createUpdate>[0] & RepliableInteraction, cid: string): Promise<void> {
    const base = this.baseContext(interaction, cid);
    const key = customIdKey(interaction.customId);
    const button = this.registry.buttons.get(key);
    if (!button) {
      await base.reply.error("This button is no longer available.");
      return;
    }
    const { params } = decodeCustomId(interaction.customId, button.params);
    const ctx = {
      ...base,
      params,
      update: createUpdate(interaction as never),
    } as unknown as ButtonContext<Record<string, unknown>>;
    await this.runWithBoundary(ctx, button.guards, () => button.run(ctx as never));
  }

  private async routeSelect(interaction: AnySelectMenuInteraction, cid: string): Promise<void> {
    const base = this.baseContext(interaction, cid);
    const key = customIdKey(interaction.customId);
    const menu = this.registry.selectMenus.get(key);
    if (!menu) {
      await base.reply.error("This menu is no longer available.");
      return;
    }
    const { params } = decodeCustomId(interaction.customId, menu.params);

    const resolved: Record<string, unknown> = {};
    if (interaction.isUserSelectMenu()) {
      resolved.users = interaction.users;
      resolved.members = interaction.members;
    } else if (interaction.isRoleSelectMenu()) {
      resolved.roles = interaction.roles;
    } else if (interaction.isChannelSelectMenu()) {
      resolved.channels = interaction.channels;
    } else if (interaction.isMentionableSelectMenu()) {
      resolved.users = interaction.users;
      resolved.roles = interaction.roles;
      resolved.members = interaction.members;
    }

    const ctx = {
      ...base,
      params,
      values: interaction.values,
      ...resolved,
      update: createUpdate(interaction),
    } as unknown as SelectMenuContext<Record<string, unknown>>;
    await this.runWithBoundary(ctx, menu.guards, () => menu.run(ctx as never));
  }

  private async routeModal(interaction: RepliableInteraction & { customId: string; fields: { getTextInputValue(id: string): string } }, cid: string): Promise<void> {
    const base = this.baseContext(interaction, cid);
    const key = customIdKey(interaction.customId);
    const modal = this.registry.modals.get(key);
    if (!modal) {
      await base.reply.error("This form is no longer available.");
      return;
    }
    const { params } = decodeCustomId(interaction.customId, modal.params);
    const fields: Record<string, string> = {};
    for (const name of Object.keys(modal.fields)) {
      fields[name] = interaction.fields.getTextInputValue(name);
    }
    const ctx = { ...base, params, fields } as unknown as ModalContext<Record<string, string>>;
    await this.runWithBoundary(ctx, modal.guards, () => modal.run(ctx as never));
  }

  private async runWithBoundary(
    ctx: BaseContext,
    guards: readonly { name: string; run: (c: BaseContext) => { ok: boolean; reason?: string } | Promise<{ ok: boolean; reason?: string }> }[],
    handler: () => unknown,
  ): Promise<void> {
    try {
      for (const guard of guards) {
        const result = await guard.run(ctx);
        if (!result.ok) {
          ctx.logger.debug({ guard: guard.name }, "Guard rejected interaction");
          await ctx.reply.error(result.reason ?? "You can't do that.");
          return;
        }
      }
      await this.pipeline(ctx, handler);
      for (const after of this.afterHooks) await after(ctx);
    } catch (error) {
      await this.fail(ctx, error);
    }
  }

  private async pipeline(ctx: BaseContext, handler: () => unknown): Promise<void> {
    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      const middleware = this.middlewares[i];
      if (middleware) {
        await middleware(ctx, () => dispatch(i + 1));
        return;
      }
      await handler();
    };
    await dispatch(0);
  }

  private async fail(ctx: BaseContext, error: unknown): Promise<void> {
    this.metrics.errors++;
    ctx.logger.error({ err: error }, "Interaction handler failed");
    for (const hook of this.errorHooks) {
      try {
        await hook(error, ctx);
      } catch {
        /* ignore */
      }
    }
    let handled = false;
    if (this.config.onError) {
      try {
        handled = (await this.config.onError(error, ctx)) !== undefined;
      } catch {
        /* ignore */
      }
    }
    if (!handled) {
      try {
        await ctx.reply.error("Something went wrong. The team has been notified.");
      } catch {
        /* the interaction may already be gone */
      }
    }
  }
}

/** Normalises an autocomplete handler result into Discord choice objects. */
function normalizeChoices(result: unknown): Array<{ name: string; value: string | number }> {
  if (!Array.isArray(result)) return [];
  return result.map((item) =>
    typeof item === "object" && item !== null
      ? (item as { name: string; value: string | number })
      : { name: String(item), value: item as string | number },
  );
}

/** Evaluates a trigger against a message. Returns `true`, a RegExp match, or `false`. */
function matchTrigger(
  trigger: import("./definitions.js").TriggerDefinition,
  message: import("discord.js").Message,
): boolean | RegExpMatchArray {
  const { pattern } = trigger;
  if (typeof pattern === "function") return pattern(message);
  if (pattern instanceof RegExp) {
    const m = message.content.match(pattern);
    return m ?? false;
  }
  const content = trigger.caseInsensitive ? message.content.toLowerCase() : message.content;
  const needle = trigger.caseInsensitive ? pattern.toLowerCase() : pattern;
  switch (trigger.mode) {
    case "equals":
      return content === needle;
    case "startsWith":
      return content.startsWith(needle);
    case "endsWith":
      return content.endsWith(needle);
    default:
      return content.includes(needle);
  }
}

/** Resolves typed option values from a chat-input interaction. */
function resolveOptions(
  optionMap: OptionMap,
  interaction: ChatInputCommandInteraction,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const o = interaction.options;
  for (const [name, opt] of Object.entries(optionMap)) {
    switch (opt.kind) {
      case "string":
        out[name] = o.getString(name, false) ?? undefined;
        break;
      case "integer":
        out[name] = o.getInteger(name, false) ?? undefined;
        break;
      case "number":
        out[name] = o.getNumber(name, false) ?? undefined;
        break;
      case "boolean":
        out[name] = o.getBoolean(name, false) ?? undefined;
        break;
      case "user":
        out[name] = o.getUser(name, false) ?? undefined;
        break;
      case "member":
        out[name] = o.getMember(name) ?? undefined;
        break;
      case "channel":
        out[name] = o.getChannel(name, false) ?? undefined;
        break;
      case "role":
        out[name] = o.getRole(name, false) ?? undefined;
        break;
      case "mentionable":
        out[name] = o.getMentionable(name, false) ?? undefined;
        break;
      case "attachment":
        out[name] = o.getAttachment(name, false) ?? undefined;
        break;
    }
  }
  return out;
}

/**
 * Creates a {@link Bot}. This is the framework's entry point.
 * @example
 * export default defineBot({ token: env("DISCORD_TOKEN"), features: "./features" });
 */
export function defineBot(config: BotConfig): Bot {
  return new Bot(config);
}

/**
 * Robust, cross-realm check that a value is a {@link Bot} - use this instead of
 * `instanceof`, which breaks across the CJS/ESM dual-package boundary.
 */
export function isBot(value: unknown): value is Bot {
  return typeof value === "object" && value !== null && (value as Record<symbol, unknown>)[Symbol.for("djsbot.bot")] === true;
}
