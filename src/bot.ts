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
  type ActivityType,
  type AnySelectMenuInteraction,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ClientEvents,
  type Interaction,
  type Message,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type PresenceData,
  type PresenceStatusData,
  type RepliableInteraction,
  type TextBasedChannel,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import comfort from "@ix-xs/node-comfort";
import { createLogger, type Logger } from "./logger.js";
import { Registry, type Registrable } from "./registry.js";
import { Container } from "./container.js";
import { computeIntents, privilegedIn, type ComputedIntents } from "./intents.js";
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
  createResponder,
  readAutocompleteOptions,
  resolveDefer,
  toAutocompleteChoices,
  type BaseContext,
  type DeferOption,
  type Responder,
} from "./context.js";
import { env, type BotConfig, type FeatureSource } from "./config.js";
import { createI18n, type I18n } from "./i18n.js";
import { createAuditLog, type AuditLog } from "./audit.js";
import { createFeatureFlags } from "./flags.js";
import { startHealthServer } from "./health.js";
import { upgradeStore, type KVStore } from "./store.js";
import { DEFAULT_THEME, renderMessage, type Theme } from "./messages.js";
import { readModalFields } from "./modal.js";
import { VERSION } from "./constants.js";
import { nextCorrelationId } from "./ids.js";
import { durationMs } from "./duration.js";
import type { Guard } from "./guards.js";
import type { OptionMap } from "./schema.js";
import type { Server } from "node:http";
import type {
  CommandDefinition,
  EventContext,
  HookRegistrar,
  JobContext,
  MiddlewareFn,
  PluginApp,
  PluginDefinition,
  SubcommandDefinition,
  TriggerDefinition,
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
  /** The framework version. */
  version: string;
  /** Gateway intents the client connects with, by name. */
  intents: string[];
  /** Partials enabled on the client, by name. */
  partials: string[];
  /** The subset of `intents` that must be switched on in the Developer Portal. */
  privilegedIntents: string[];
  /** Slash command names. */
  commands: string[];
  /** User context-menu command names. */
  userCommands: string[];
  /** Message context-menu command names. */
  messageCommands: string[];
  /** Button routing ids. */
  buttons: string[];
  /** Select menu routing ids. */
  selectMenus: string[];
  /** Modal routing ids. */
  modals: string[];
  /** The event of each registered listener. */
  events: string[];
  /** Message trigger names. */
  triggers: string[];
  /** Scheduled jobs, as `name (schedule)`. */
  jobs: string[];
  /** Service tokens registered in the container. */
  services: string[];
  /** Plugins, as `name@version`. */
  plugins: string[];
  /** Feature names. */
  features: string[];
  /** Deployment plan: command names deployed globally, and per guild id. */
  deployment: {
    /** Names of the commands deployed globally. */
    global: string[];
    /** Names of the commands deployed to each guild, by guild id. */
    guilds: Record<string, string[]>;
  };
}

/** A snapshot of the runtime counters, as returned by {@link Bot.stats}. */
export interface BotStats {
  /** Milliseconds since this process created the bot. */
  uptimeMs: number;
  /** Interactions received, of every kind. */
  interactions: number;
  /** Slash and context-menu commands routed to a handler. */
  commands: number;
  /** Button and select-menu interactions routed to a handler. */
  components: number;
  /** Modal submissions routed to a handler. */
  modals: number;
  /** Autocomplete requests answered. */
  autocompletes: number;
  /** Interactions refused by a guard. */
  guardRejections: number;
  /** Handlers, events, triggers and jobs that threw. */
  errors: number;
  /** Average handler duration, in milliseconds. */
  handlerAvgMs: number;
  /** Slowest handler seen, in milliseconds. */
  handlerMaxMs: number;
}

/**
 * A cross-realm brand. Because the CLI is CJS and user code is usually ESM, the
 * two load different copies of this module, so `instanceof Bot` is unreliable.
 * A registered symbol is shared across realms and survives the dual-package
 * boundary - see {@link isBot}.
 */
const BOT_BRAND: unique symbol = Symbol.for("djsbot.bot") as never;

/**
 * How long a shutdown started by a signal may take before the process is ended
 * anyway. Above the 10 seconds running jobs are given, so hooks, plugins and
 * services still get their turn after a slow job.
 */
const SHUTDOWN_DEADLINE = "30s";

/** The authors a trigger does not answer again yet. */
type TriggerCooldown = InstanceType<typeof comfort.Cache<string, true>>;

/** What the router needs to run one handler inside the boundary. */
interface Dispatch {
  readonly ctx: BaseContext;
  readonly responder: Responder;
  readonly guards: readonly Guard[];
  readonly defer: DeferOption | undefined;
  readonly handler: () => unknown;
}

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
  private loading?: Promise<void>;
  private presenceRotation?: { stop: () => void };
  private i18n?: I18n;
  private auditLog?: AuditLog;
  private store?: KVStore;
  private healthServer?: Server;
  private signals?: { dispose: () => void };
  /** Takes the bot out of node-comfort's shutdown sequence. */
  private offShutdown?: () => void;
  private readonly theme: Theme;
  private readonly startedAt = Date.now();
  /** Options whose dropped autocomplete suggestions were already reported. */
  private readonly warnedAutocomplete = new Set<string>();
  private readonly counters = {
    interactions: 0,
    commands: 0,
    components: 0,
    modals: 0,
    autocompletes: 0,
    guardRejections: 0,
    errors: 0,
    handled: 0,
    handlerMsTotal: 0,
    handlerMsMax: 0,
  };
  private readonly pending: Registrable[] = [];

  private readonly middlewares: MiddlewareFn[] = [];
  private readonly afterHooks: Array<(ctx: BaseContext, info: { durationMs: number }) => unknown> = [];
  private readonly errorHooks: Array<(error: unknown, ctx?: BaseContext) => unknown> = [];
  private readonly readyHooks: Array<(client: Client<true>) => unknown> = [];
  private readonly shutdownHooks: Array<() => unknown> = [];

  public constructor(config: BotConfig) {
    this.config = config;
    this.logger = createLogger(config.logger);
    this.theme = { ...DEFAULT_THEME, ...config.theme };
  }

  /** The connected discord.js client. Throws if the bot has not started. */
  public get client(): Client<true> {
    if (!this._client) throw new Error("Bot has not started yet - call bot.start() first.");
    return this._client;
  }

  /** The configured dev guild (from `deploy.devGuildId` or `DISCORD_DEV_GUILD`), if any. */
  public get devGuildId(): string | undefined {
    return this.config.deploy?.devGuildId ?? env.optional("DISCORD_DEV_GUILD");
  }

  /** Registers additional definitions explicitly (in addition to `config.features`). */
  public use(...items: Registrable[]): this {
    this.pending.push(...items);
    return this;
  }

  /** A snapshot of the runtime counters (the numbers behind `/metrics`). */
  public stats(): BotStats {
    const c = this.counters;
    return {
      uptimeMs: Date.now() - this.startedAt,
      interactions: c.interactions,
      commands: c.commands,
      components: c.components,
      modals: c.modals,
      autocompletes: c.autocompletes,
      guardRejections: c.guardRejections,
      errors: c.errors,
      handlerAvgMs: c.handled ? Math.round((c.handlerMsTotal / c.handled) * 100) / 100 : 0,
      handlerMaxMs: Math.round(c.handlerMsMax * 100) / 100,
    };
  }

  /* ----------------------------- loading ------------------------------- */

  /**
   * Discovers features, registers everything, wires plugins, resolves services
   * and computes intents. Idempotent. Called automatically by {@link start}.
   */
  public load(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    // Share one in-flight load between concurrent callers (start + deploy).
    this.loading ??= this.doLoad().finally(() => {
      this.loading = undefined;
    });
    return this.loading;
  }

  private async doLoad(): Promise<void> {
    const registrables = await this.collectRegistrables();
    this.registry.addAll(registrables);
    for (const plugin of this.config.plugins ?? []) this.registry.add(plugin);

    const tokens = new Set<string>();
    for (const service of this.registry.services) {
      if (tokens.has(service.name)) {
        this.logger.warn({ service: service.name }, "Two services share this token; the one registered last is used");
      }
      tokens.add(service.name);
      this.container.register(service);
    }
    if (this.config.store) {
      // An adapter written against an earlier version gains the newer methods.
      this.store = upgradeStore(this.config.store);
      this.container.registerValue("store", this.store);
    }
    if (this.config.i18n) this.i18n = createI18n(this.config.i18n);
    if (this.config.audit) {
      this.auditLog = createAuditLog(this.config.audit);
      this.container.registerValue("audit", this.auditLog);
    }
    if (this.config.flags) {
      // Reuse the bot's configured store by default, so you don't pass it twice.
      const flagsOptions = { ...this.config.flags, store: this.config.flags.store ?? this.store };
      this.container.registerValue("flags", createFeatureFlags(flagsOptions));
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
    // Config-provided services (store, audit, flags) are capabilities too. They
    // live in the container rather than in `registry.services`, so consult it as
    // well. Plugins have not run `setup` yet: what a plugin registers there
    // counts only if the plugin also declares it in `provides`.
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

  private pluginApp(plugin: PluginDefinition): PluginApp {
    return {
      logger: this.logger.child({ plugin: plugin.name }),
      hooks: this.hookRegistrar(),
      config: this.config,
      services: {
        register: (token, value) => this.container.registerValue(token, value),
        has: (token) => this.container.has(token),
      },
    };
  }

  private async runPluginSetup(): Promise<void> {
    for (const plugin of this.registry.plugins) {
      await plugin.setup(this.pluginApp(plugin));
      this.logger.debug({ plugin: plugin.name, version: plugin.version }, "Plugin loaded");
    }
  }

  private resolveIntents(): ComputedIntents {
    const setting = this.config.intents;

    if (Array.isArray(setting)) {
      return { intents: setting, partials: this.config.partials ?? [], privileged: privilegedIn(setting) };
    }

    const adjustments = typeof setting === "object" ? setting : {};
    const computed = computeIntents(this.registry.events, {
      hasTriggers: this.registry.triggers.length > 0,
      ...adjustments,
    });
    if (this.config.partials) {
      computed.partials = [...new Set([...computed.partials, ...this.config.partials])];
    }
    if (computed.privileged.length > 0) {
      this.logger.warn(
        { privileged: computed.privileged },
        "Privileged intents in use - enable them in the Developer Portal (Bot > Privileged Gateway Intents)",
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

    const token = this.config.token ?? env.optional("DISCORD_TOKEN");
    if (!token) throw new BotError("DJSBOT_E001");

    // If sharding is enabled and we're the manager process (not a spawned
    // shard), launch the ShardingManager and stop - children run the bot.
    if (this.config.sharding && !isShardChild()) {
      await launchShardManager(process.argv[1] ?? "", token, normalizeSharding(this.config.sharding), this.logger);
      return;
    }

    const computed = this.computed!;
    const extra = this.config.client ?? {};

    const client = new Client({
      ...extra,
      intents: computed.intents,
      partials: [...new Set([...computed.partials, ...(extra.partials ?? [])])],
      presence: this.config.presence ?? extra.presence,
    }) as Client<true>;
    this._client = client;

    this.attachEvents(client);
    this.attachTriggers(client);
    client.on(Events.InteractionCreate, (interaction) => void this.handleInteraction(interaction));
    client.once(Events.ClientReady, (ready) => {
      void this.onReady(ready).catch((error) => this.report(error, "Startup hook failed"));
    });

    this.installSignals();
    await client.login(token);
  }

  /**
   * Logs an error raised outside an interaction (event, trigger, job, startup)
   * and forwards it to every error hook and to `config.onError`.
   */
  private report(error: unknown, message: string, fields: Record<string, unknown> = {}): void {
    this.counters.errors++;
    this.logger.error({ err: error, ...fields }, message);
    this.notifyErrorHooks(error);
  }

  /**
   * Hands an error to every error hook and to `config.onError`, without
   * waiting for them. A hook that throws or rejects is ignored: reporting an
   * error must never raise another one.
   */
  private notifyErrorHooks(error: unknown): void {
    for (const hook of this.errorHooks) void comfort.func.to(() => hook(error));
    const onError = this.config.onError;
    if (onError) void comfort.func.to(() => onError(error));
  }

  private attachEvents(client: Client<true>): void {
    for (const def of this.registry.events) {
      const context: EventContext = {
        client,
        services: this.container.view(),
        logger: this.logger.child({ event: def.event }),
      };
      const run = def.run as (...args: unknown[]) => unknown;
      const listener = (...args: unknown[]): void => {
        // The promise also covers a synchronous throw inside the listener.
        void new Promise((resolve) => resolve(run(...args, context))).catch((error) =>
          this.report(error, "Event handler failed", { event: def.event }),
        );
      };
      if (def.once) client.once(def.event as keyof ClientEvents, listener as never);
      else client.on(def.event as keyof ClientEvents, listener as never);
    }
  }

  private attachTriggers(client: Client<true>): void {
    const triggers = this.registry.triggers;
    if (triggers.length === 0) return;

    // One cache of authors per trigger that has a cooldown: an entry expires
    // with the cooldown, and the cache drops the expired ones as it grows.
    const cooldowns = new Map<string, TriggerCooldown>();
    for (const t of triggers) {
      const ms = durationMs(t.cooldown, 0);
      if (ms > 0) cooldowns.set(t.name, new comfort.Cache<string, true>({ ttl: ms }));
    }

    client.on(Events.MessageCreate, (message) => {
      void this.handleTriggers(message, triggers, cooldowns);
    });
  }

  private async handleTriggers(
    message: Message,
    triggers: readonly TriggerDefinition[],
    cooldowns: ReadonlyMap<string, TriggerCooldown>,
  ): Promise<void> {
    for (const trigger of triggers) {
      try {
        if (trigger.ignoreBots && message.author.bot) continue;
        const match = matchTrigger(trigger, message);
        if (!match) continue;

        const cooling = cooldowns.get(trigger.name);
        if (cooling) {
          if (cooling.has(message.author.id)) continue;
          cooling.set(message.author.id, true);
        }

        const correlationId = nextCorrelationId();
        const ctx = {
          message,
          client: this.client,
          author: message.author,
          member: message.member,
          guild: message.guild,
          channel: message.channel,
          services: this.container.view(),
          logger: this.logger.child({ trigger: trigger.name, correlationId }),
          correlationId,
          match: match === true ? null : match,
          reply: (content: unknown) => message.reply(content as never),
          send: (content: unknown) => (message.channel as { send: (c: unknown) => Promise<unknown> }).send(content),
        };
        await trigger.run(ctx as never);
      } catch (error) {
        this.report(error, "Trigger handler failed", { trigger: trigger.name });
      }
    }
  }

  private async onReady(client: Client<true>): Promise<void> {
    this.logger.info(
      { user: client.user.tag, guilds: client.guilds.cache.size, version: VERSION },
      "Ready",
    );

    for (const hook of this.readyHooks) {
      try {
        await hook(client);
      } catch (error) {
        this.report(error, "onReady hook failed");
      }
    }

    this.startScheduler(client);
    this.startPresenceRotation(client);
    this.startHealth(client);
    await this.maybeAutoDeploy(client);
  }

  private startHealth(client: Client<true>): void {
    if (this.config.health === undefined) return;
    const base = typeof this.config.health === "number" ? { port: this.config.health } : this.config.health;
    const userOnError = typeof this.config.health === "number" ? undefined : this.config.health.onError;
    const options = {
      ...base,
      onError: (error: Error) => {
        this.logger.error({ err: error }, "Health server failed to start");
        userOnError?.(error);
      },
    };
    this.healthServer = startHealthServer(() => {
      const { uptimeMs, ...metrics } = this.stats();
      return {
        ready: client.isReady(),
        uptimeMs,
        metrics: {
          ...metrics,
          guilds: client.guilds.cache.size,
          wsPingMs: Math.max(0, Math.round(client.ws.ping)),
          memoryRssMb: Math.round(process.memoryUsage().rss / 1_048_576),
        },
        shard: client.shard ? { id: client.shard.ids[0] ?? 0, count: client.shard.count } : undefined,
      };
    }, options);
    this.logger.info({ port: options.port ?? 3000 }, "Health server listening");
  }

  private startPresenceRotation(client: Client<true>): void {
    const rotation = this.config.presenceRotation;
    if (!rotation || rotation.items.length === 0) return;
    // An interval that cannot be read, or that is not positive, falls back to a minute.
    const parsed = durationMs(rotation.interval, 60_000);
    const intervalMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;

    let index = 0;
    const apply = () => {
      client.user.setPresence(rotation.items[index % rotation.items.length]!);
      index++;
    };
    apply();
    this.presenceRotation = comfort.time.every(intervalMs, apply, {
      unref: true,
      onError: (error) => this.report(error, "Presence rotation failed"),
    });
  }

  /** Updates the bot's gateway presence at runtime. */
  public setPresence(presence: PresenceData): void {
    this.client.user.setPresence(presence);
  }

  /** Shortcut to set a single activity (e.g. `setActivity("/help", { type: ActivityType.Watching })`). */
  public setActivity(
    name: string,
    options: {
      /** The verb shown before the name. Default `ActivityType.Playing`. */
      type?: ActivityType;
      /** A Twitch or YouTube URL, for `ActivityType.Streaming`. */
      url?: string;
      /** The status dot: `"online"`, `"idle"`, `"dnd"` or `"invisible"`. */
      status?: PresenceStatusData;
    } = {},
  ): void {
    this.client.user.setPresence({
      activities: [{ name, type: options.type, url: options.url }],
      status: options.status,
    });
  }

  private startScheduler(client: Client<true>): void {
    // On a sharded bot every shard runs this code: jobs marked `shard: "first"`
    // only start on the shard that owns id 0.
    const isFirstShard = !client.shard || client.shard.ids.includes(0);
    const jobs = this.registry.jobs.filter((job) => job.shard === "all" || isFirstShard);
    if (jobs.length === 0) return;

    this.scheduler = new Scheduler(
      jobs,
      (job, signal, correlationId): JobContext => ({
        client,
        services: this.container.view(),
        logger: this.logger.child({ job: job.name, correlationId }),
        signal,
        correlationId,
      }),
      this.logger,
      {
        // The scheduler already logged it; only forward to the hooks.
        onError: (error) => {
          this.counters.errors++;
          this.notifyErrorHooks(error);
        },
      },
    );
    this.scheduler.start();
    this.logger.debug({ jobs: jobs.length }, "Scheduler started");
  }

  private async maybeAutoDeploy(client: Client<true>): Promise<void> {
    const dev = process.env.NODE_ENV !== "production";
    const auto = this.config.deploy?.autoDeploy ?? dev;
    if (!auto) return;
    // One deploy per process group is enough: let shard 0 do it.
    if (client.shard && !client.shard.ids.includes(0)) return;

    const token = this.config.token ?? env.optional("DISCORD_TOKEN");
    if (!token) return;
    const clientId = this.config.clientId ?? env.optional("DISCORD_CLIENT_ID") ?? client.application.id;
    const devGuildId = this.devGuildId;
    // In development with a dev guild, mirror everything there for instant
    // testing; otherwise reconcile the real plan (global + per-command guilds).
    const guildId = dev && devGuildId ? devGuildId : undefined;

    try {
      await deployCommands(this.registry, { token, clientId, guildId, logger: this.logger });
    } catch (error) {
      this.logger.error({ err: error }, "Auto-deploy failed");
    }
  }

  /**
   * An uncaught error is reported and the process stays up. A signal runs
   * {@link shutdown} through node-comfort's shutdown sequence, which ends the
   * process in every case: with code 0 once the shutdown is done, with code 1
   * when it fails, when it takes longer than {@link SHUTDOWN_DEADLINE}, or
   * when a second signal arrives before it is over.
   */
  private installSignals(): void {
    this.signals = comfort.utils
      .dontCrash()
      .on("error", (error: unknown) => {
        this.report(error, "Uncaught error (kept alive)");
      })
      .on("sig", (signal: NodeJS.Signals) => {
        this.logger.info({ signal }, "Signal received - shutting down");
        void comfort.sys.shutdown();
      });
    // The signals are listened to above, so that `dispose()` removes them all.
    this.offShutdown = comfort.sys.onShutdown(() => this.shutdown(), { timeout: SHUTDOWN_DEADLINE, signals: [] });
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
    const { token, clientId } = this.deployCredentials();

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
  public async clear(
    options: {
      /** The guild to wipe. Omit to wipe the global commands. */
      guildId?: string;
      /** Report what would be removed without writing anything. */
      dryRun?: boolean;
    } = {},
  ): Promise<DeployTargetResult> {
    await this.load();
    const { token, clientId } = this.deployCredentials();
    return clearScope({ token, clientId, guildId: options.guildId, dryRun: options.dryRun, logger: this.logger });
  }

  /** Resolves the token + client id needed to deploy, with clear coded errors. */
  private deployCredentials(): { token: string; clientId: string } {
    const token = this.config.token ?? env.optional("DISCORD_TOKEN");
    if (!token) throw new BotError("DJSBOT_E001");
    const clientId = this.config.clientId ?? env.optional("DISCORD_CLIENT_ID");
    if (!clientId) throw new BotError("DJSBOT_E002");
    return { token, clientId };
  }

  private readonly deployStatePath = ".djs-bot/deploy-state.json";
  private readDeployState(): string[] {
    const state = comfort.fs.readJSON<{ guilds?: string[] }>(this.deployStatePath, { guilds: [] });
    return Array.isArray(state?.guilds) ? state.guilds : [];
  }
  private writeDeployState(guilds: string[]): void {
    // Best effort: without the file, guilds that are no longer targeted keep
    // their commands until a deploy that knows about them.
    if (!comfort.fs.writeJSON(this.deployStatePath, { guilds }, { fsync: true })) {
      this.logger.debug({ path: this.deployStatePath }, "Could not write the deploy state");
    }
  }

  /**
   * Gracefully stops everything: waits for running jobs, runs the shutdown
   * hooks, tears down plugins, disposes services, closes the store and
   * disconnects. Safe to call more than once.
   */
  public async shutdown(): Promise<void> {
    const scheduler = this.scheduler;
    this.scheduler = undefined;
    await scheduler?.stop();

    this.presenceRotation?.stop();
    this.presenceRotation = undefined;
    this.healthServer?.close();
    this.healthServer = undefined;

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
        await plugin.teardown(this.pluginApp(plugin));
      } catch (error) {
        this.logger.error({ err: error, plugin: plugin.name }, "Plugin teardown failed");
      }
    }
    await this.container.disposeAll((error, token) =>
      this.logger.error({ err: error, service: token }, "Service dispose failed"),
    );
    try {
      await this.store?.close();
    } catch (error) {
      this.logger.error({ err: error }, "Store close failed");
    }
    this.store = undefined;

    if (this._client) {
      await this._client.destroy();
      this._client = undefined;
    }
    this.offShutdown?.();
    this.offShutdown = undefined;
    this.signals?.dispose();
    this.signals = undefined;
    this.logger.info({}, "Shutdown complete");
  }

  /** A structured, inspectable description for `djs-bot explain`. */
  public async describe(): Promise<BotDescription> {
    await this.load();
    const c = this.computed!;
    return {
      version: VERSION,
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
    const correlationId = nextCorrelationId();
    this.counters.interactions++;
    try {
      if (interaction.isChatInputCommand()) await this.routeCommand(interaction, correlationId);
      else if (interaction.isAutocomplete()) await this.routeAutocomplete(interaction, correlationId);
      else if (interaction.isUserContextMenuCommand()) await this.routeUserCommand(interaction, correlationId);
      else if (interaction.isMessageContextMenuCommand()) await this.routeMessageCommand(interaction, correlationId);
      else if (interaction.isButton()) await this.routeButton(interaction, correlationId);
      else if (interaction.isAnySelectMenu()) await this.routeSelect(interaction, correlationId);
      else if (interaction.isModalSubmit()) await this.routeModal(interaction, correlationId);
    } catch (error) {
      this.counters.errors++;
      this.logger.error({ err: error, correlationId }, "Interaction routing failed");
    }
  }

  private open(interaction: RepliableInteraction, correlationId: string): { base: BaseContext; responder: Responder } {
    const responder = createResponder(interaction, this.theme);
    const locale = interaction.locale ?? this.i18n?.defaultLocale ?? "en";
    const i18n = this.i18n;
    const messages = this.config.messages;

    const base: BaseContext = {
      client: this.client,
      interaction,
      user: interaction.user,
      guild: interaction.guild,
      guildId: interaction.guildId,
      channel: interaction.channel as TextBasedChannel | null,
      channelId: interaction.channelId,
      // Outside a cached guild Discord sends a raw API member, not a GuildMember.
      member: interaction.inCachedGuild() ? interaction.member : null,
      services: this.container.view(),
      logger: this.logger.child({ correlationId, userId: interaction.user.id }),
      correlationId,
      locale,
      owners: this.config.owners ?? [],
      t: (key, vars) => (i18n ? i18n.t(locale, key, vars) : key),
      say: (key, vars) => renderMessage(messages, key, (vars ?? {}) as never, base),
      audit: async (action, details) => {
        if (!this.auditLog) return;
        await this.auditLog.record(action, {
          actorId: interaction.user.id,
          guildId: interaction.guildId,
          targetId: details?.targetId,
          metadata: details?.metadata,
        });
      },
      reply: responder.reply,
    };
    return { base, responder };
  }

  /** Finds the subcommand an interaction targets, if the command uses them. */
  private subcommandOf(
    command: CommandDefinition,
    interaction: ChatInputCommandInteraction | AutocompleteInteraction,
  ): { sub: SubcommandDefinition | undefined; name: string } | undefined {
    if (!command.subcommands && !command.groups) return undefined;
    const groupName = interaction.options.getSubcommandGroup(false);
    const subName = interaction.options.getSubcommand(false);
    const sub = groupName
      ? command.groups?.[groupName]?.subcommands[subName ?? ""]
      : subName
        ? command.subcommands?.[subName]
        : undefined;
    return { sub, name: [groupName, subName].filter(Boolean).join(" ") };
  }

  private async routeCommand(interaction: ChatInputCommandInteraction, cid: string): Promise<void> {
    const { base, responder } = this.open(interaction, cid);
    const command = this.registry.commands.get(interaction.commandName);
    if (!command) {
      await base.reply.error(base.say("unknownCommand", { name: interaction.commandName }));
      return;
    }
    this.counters.commands++;
    if (this.auditLog && this.config.audit?.autoRecordCommands) {
      void this.auditLog.record(`command:${command.name}`, {
        actorId: interaction.user.id,
        guildId: interaction.guildId,
      });
    }

    const showModal = responder.showModal;
    const target = this.subcommandOf(command, interaction);
    if (target) {
      const { sub } = target;
      if (!sub) {
        await base.reply.error(base.say("unknownSubcommand", { name: target.name }));
        return;
      }
      const options = resolveOptions(sub.options, interaction);
      const ctx = { ...base, options, showModal };
      await this.dispatch({
        ctx,
        responder,
        guards: [...command.guards, ...sub.guards, ...memberGuards(sub.options, options)],
        defer: sub.defer ?? command.defer,
        handler: () => sub.run(ctx as never),
      });
      return;
    }

    const options = resolveOptions(command.options, interaction);
    const ctx = { ...base, options, showModal };
    await this.dispatch({
      ctx,
      responder,
      guards: [...command.guards, ...memberGuards(command.options, options)],
      defer: command.defer,
      handler: () => command.run?.(ctx as never),
    });
  }

  private async routeAutocomplete(interaction: AutocompleteInteraction, cid: string): Promise<void> {
    const command = this.registry.commands.get(interaction.commandName);
    if (!command) return void (await interaction.respond([]));

    const target = this.subcommandOf(command, interaction);
    const optionMap: OptionMap = target ? (target.sub?.options ?? {}) : command.options;

    const focused = interaction.options.getFocused(true);
    const option = optionMap[focused.name];
    const handler = option?.config.autocomplete;
    // `autocomplete: true` means the bot answers from its own listener.
    if (handler === true) return;
    if (!option || typeof handler !== "function") return void (await interaction.respond([]));

    this.counters.autocompletes++;
    try {
      const locale = interaction.locale ?? this.i18n?.defaultLocale ?? "en";
      const i18n = this.i18n;
      const ctx = {
        interaction,
        client: this.client,
        user: interaction.user,
        guild: interaction.guild,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        services: this.container.view(),
        logger: this.logger.child({ correlationId: cid, autocomplete: focused.name }),
        focused: focused.name,
        value: String(focused.value ?? ""),
        options: readAutocompleteOptions(interaction.options.data as never),
        locale,
        t: (key: string, vars?: Record<string, unknown>) => (i18n ? i18n.t(locale, key, vars) : key),
      };
      const result = await (handler as (c: unknown) => unknown)(ctx);
      const { choices, dropped } = toAutocompleteChoices(result, option.kind);
      // Say it once per option: this runs on every keystroke.
      const where = `${interaction.commandName}:${target?.name ?? ""}:${focused.name}`;
      if (dropped > 0 && !this.warnedAutocomplete.has(where)) {
        this.warnedAutocomplete.add(where);
        this.logger.warn(
          { command: interaction.commandName, option: focused.name, dropped },
          "Autocomplete suggestions were left out: a value must match the option's type, and a text value cannot exceed 100 characters",
        );
      }
      await interaction.respond(choices);
    } catch (error) {
      this.counters.errors++;
      this.logger.error({ err: error, correlationId: cid }, "Autocomplete handler failed");
      try {
        await interaction.respond([]);
      } catch {
        /* interaction may have expired */
      }
    }
  }

  private async routeUserCommand(interaction: UserContextMenuCommandInteraction, cid: string): Promise<void> {
    const { base, responder } = this.open(interaction, cid);
    const command = this.registry.userCommands.get(interaction.commandName);
    if (!command) {
      await base.reply.error(base.say("unknownCommand", { name: interaction.commandName }));
      return;
    }
    this.counters.commands++;
    const ctx = {
      ...base,
      targetUser: interaction.targetUser,
      targetMember: interaction.inCachedGuild() ? (interaction.targetMember ?? null) : null,
      showModal: responder.showModal,
    };
    await this.dispatch({
      ctx,
      responder,
      guards: command.guards,
      defer: command.defer,
      handler: () => command.run(ctx as never),
    });
  }

  private async routeMessageCommand(interaction: MessageContextMenuCommandInteraction, cid: string): Promise<void> {
    const { base, responder } = this.open(interaction, cid);
    const command = this.registry.messageCommands.get(interaction.commandName);
    if (!command) {
      await base.reply.error(base.say("unknownCommand", { name: interaction.commandName }));
      return;
    }
    this.counters.commands++;
    const ctx = { ...base, targetMessage: interaction.targetMessage, showModal: responder.showModal };
    await this.dispatch({
      ctx,
      responder,
      guards: command.guards,
      defer: command.defer,
      handler: () => command.run(ctx as never),
    });
  }

  private async routeButton(interaction: ButtonInteraction, cid: string): Promise<void> {
    const button = this.registry.buttons.get(customIdKey(interaction.customId));
    if (!button) {
      // Not one of our registered buttons - it may belong to a self-managed
      // collector (paginate/confirm/awaitMessageComponent). Leave it untouched
      // so that collector can respond; acknowledging it here would break them.
      this.logger.debug({ customId: interaction.customId, correlationId: cid }, "unrouted button left for any active collector");
      return;
    }
    this.counters.components++;
    const { base, responder } = this.open(interaction, cid);
    const params = await this.decodeParams(interaction.customId, button.params, base);
    if (!params) return;
    const ctx = { ...base, params, update: responder.update!, showModal: responder.showModal };
    await this.dispatch({
      ctx,
      responder,
      guards: button.guards,
      defer: button.defer,
      handler: () => button.run(ctx as never),
    });
  }

  private async routeSelect(interaction: AnySelectMenuInteraction, cid: string): Promise<void> {
    const menu = this.registry.selectMenus.get(customIdKey(interaction.customId));
    if (!menu) {
      // May belong to a self-managed collector - leave it for that collector.
      this.logger.debug({ customId: interaction.customId, correlationId: cid }, "unrouted select left for any active collector");
      return;
    }
    this.counters.components++;
    const { base, responder } = this.open(interaction, cid);
    const params = await this.decodeParams(interaction.customId, menu.params, base);
    if (!params) return;

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
      update: responder.update!,
      showModal: responder.showModal,
    };
    await this.dispatch({
      ctx,
      responder,
      guards: menu.guards,
      defer: menu.defer,
      handler: () => menu.run(ctx as never),
    });
  }

  private async routeModal(interaction: ModalSubmitInteraction, cid: string): Promise<void> {
    const modal = this.registry.modals.get(customIdKey(interaction.customId));
    if (!modal) {
      // May belong to a self-managed awaitModalSubmit - leave it for that waiter.
      this.logger.debug({ customId: interaction.customId, correlationId: cid }, "unrouted modal left for any active collector");
      return;
    }
    this.counters.modals++;
    const { base, responder } = this.open(interaction, cid);
    const params = await this.decodeParams(interaction.customId, modal.params, base);
    if (!params) return;
    const ctx = { ...base, params, fields: readModalFields(modal.fields, interaction.fields) };
    await this.dispatch({
      ctx,
      responder,
      guards: modal.guards,
      defer: modal.defer,
      handler: () => modal.run(ctx as never),
    });
  }

  /**
   * Runs one handler inside the error boundary: automatic deferral, middleware,
   * guards, the handler itself, then the after hooks.
   *
   * Middleware wraps the guards as well as the handler, so a plugin can stop an
   * interaction before any guard runs (maintenance mode) and time the whole
   * thing (logging, metrics).
   */
  /**
   * Decodes the params a component carries in its customId. A payload that
   * cannot be decoded (`DJSBOT_E021`) is treated like a failing handler: the
   * user is told, and the error hooks run. Returns `undefined` in that case.
   */
  private async decodeParams(
    customId: string,
    schema: Parameters<typeof decodeCustomId>[1],
    ctx: BaseContext,
  ): Promise<Record<string, unknown> | undefined> {
    try {
      return decodeCustomId(customId, schema).params as Record<string, unknown>;
    } catch (error) {
      await this.fail(ctx, error);
      return undefined;
    }
  }

  private async dispatch({ ctx, responder, guards, defer, handler }: Dispatch): Promise<void> {
    const started = performance.now();
    const deferral = resolveDefer(defer ?? this.config.defaults?.defer);
    if (deferral) responder.armDefer(deferral);

    let completed = false;
    try {
      await this.pipeline(ctx, async () => {
        for (const guard of guards) {
          const result = await guard.run(ctx);
          if (!result.ok) {
            this.counters.guardRejections++;
            ctx.logger.debug({ guard: guard.name }, "Guard rejected interaction");
            await ctx.reply.error(result.reason ?? ctx.say("guardDenied"));
            return;
          }
        }
        await handler();
        completed = true;
      });
      if (completed) {
        const info = { durationMs: performance.now() - started };
        for (const after of this.afterHooks) {
          // The handler already succeeded and answered: a failing hook is
          // reported, but must not turn into an error message for the user.
          try {
            await after(ctx, info);
          } catch (error) {
            this.report(error, "afterInteraction hook failed", { correlationId: ctx.correlationId });
          }
        }
      }
    } catch (error) {
      await this.fail(ctx, error);
    } finally {
      responder.disarm();
      const elapsed = performance.now() - started;
      this.counters.handled++;
      this.counters.handlerMsTotal += elapsed;
      if (elapsed > this.counters.handlerMsMax) this.counters.handlerMsMax = elapsed;
    }
  }

  private async pipeline(ctx: BaseContext, handler: () => Promise<void>): Promise<void> {
    const { middlewares } = this;
    if (middlewares.length === 0) return handler();

    let index = -1;
    const run = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      const middleware = middlewares[i];
      if (middleware) {
        await middleware(ctx, () => run(i + 1));
        return;
      }
      await handler();
    };
    await run(0);
  }

  private async fail(ctx: BaseContext, error: unknown): Promise<void> {
    this.counters.errors++;
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
        await ctx.reply.error(ctx.say("error"));
      } catch {
        /* the interaction may already be gone */
      }
    }
  }
}

/**
 * `s.member({ required: true })` promises a `GuildMember`, but Discord only
 * has a user option: the picked user may not be in the server, or there may be
 * no server. Rather than handing the handler `undefined` behind a non-optional
 * type, a guard refuses the command with an explanation. It runs after the
 * command's own guards, so `inGuild()` still answers first in a DM.
 */
function memberGuards(optionMap: OptionMap, options: Record<string, unknown>): Guard[] {
  const missing = Object.entries(optionMap).find(
    ([name, option]) => option.kind === "member" && option.required && options[name] === undefined,
  );
  if (!missing) return [];
  const [name] = missing;
  return [{ kind: "guard", name: "memberOption", run: (ctx) => ({ ok: false, reason: ctx.say("notAMember", { option: name }) }) }];
}

/** Evaluates a trigger against a message. Returns `true`, a RegExp match, or `false`. */
function matchTrigger(trigger: TriggerDefinition, message: Message): boolean | RegExpMatchArray {
  const { pattern } = trigger;
  if (typeof pattern === "function") return pattern(message);
  if (pattern instanceof RegExp) {
    // A global or sticky RegExp keeps state in `lastIndex` between calls.
    // `exec` returns the groups even with the `g` flag, which `match` does not.
    pattern.lastIndex = 0;
    const match = pattern.exec(message.content);
    pattern.lastIndex = 0;
    return match ?? false;
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
