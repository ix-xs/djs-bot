/**
 * `@ix-xs/djs-bot` — a TypeScript-first, production-ready framework for Discord
 * bots built on discord.js.
 *
 * Write features, not plumbing: typed slash commands, typed customId routing,
 * automatic intents, error boundaries, dependency injection, plugins, jobs and
 * a batteries-included CLI.
 *
 * @packageDocumentation
 */

// Core entry points
export { Bot, defineBot, isBot, type BotDescription, type DeployCallOptions } from "./bot.js";
export { defineConfig, env, loadEnvFile, type BotConfig, type DeployConfig, type FeatureSource } from "./config.js";

// Definitions (the authoring surface)
export {
  defineCommand,
  subcommand,
  defineUserCommand,
  defineMessageCommand,
  defineEvent,
  defineTrigger,
  defineButton,
  defineSelectMenu,
  defineUserSelect,
  defineRoleSelect,
  defineChannelSelect,
  defineMentionableSelect,
  defineModal,
  defineService,
  defineJob,
  definePlugin,
  defineFeature,
  type CommandDefinition,
  type CommandInput,
  type SubcommandDefinition,
  type SubcommandGroupDefinition,
  type SubcommandInput,
  type UserCommandDefinition,
  type UserCommandInput,
  type MessageCommandDefinition,
  type MessageCommandInput,
  type InstallContext,
  type InteractionContext,
  type TriggerDefinition,
  type TriggerInput,
  type TriggerContext,
  type TriggerMode,
  type TriggerPattern,
  type EventDefinition,
  type ButtonDefinition,
  type ButtonInput,
  type ButtonVisualOptions,
  type SelectMenuDefinition,
  type SelectMenuInput,
  type SelectVisualOptions,
  type NativeSelectVisualOptions,
  type SelectType,
  type SelectRoutable,
  type AnySelectDefinition,
  type UserSelectDefinition,
  type RoleSelectDefinition,
  type ChannelSelectDefinition,
  type MentionableSelectDefinition,
  type ModalDefinition,
  type ModalInput,
  type JobDefinition,
  type JobInput,
  type JobContext,
  type EventContext,
  type PluginDefinition,
  type PluginInput,
  type PluginApp,
  type HookRegistrar,
  type MiddlewareFn,
  type FeatureDefinition,
  type FeatureInput,
  type AnyDefinition,
} from "./definitions.js";

// Schema builders
export {
  s,
  p,
  field,
  type OptionKind,
  type OptionDef,
  type OptionMap,
  type InferOptions,
  type ParamCodec,
  type ParamMap,
  type InferParams,
  type FieldDef,
  type FieldMap,
  type InferFields,
} from "./schema.js";

// Guards
export {
  guard,
  pass,
  fail,
  inGuild,
  dmOnly,
  hasPermission,
  botHasPermission,
  inChannel,
  ownerOnly,
  cooldown,
  type Guard,
  type GuardFn,
  type GuardResult,
  type CooldownScope,
} from "./guards.js";

// Contexts
export type {
  BaseContext,
  CommandContext,
  UserCommandContext,
  MessageCommandContext,
  ButtonContext,
  SelectMenuContext,
  ModalContext,
  ReplyFn,
  UpdateFn,
  ReplyContent,
  SemanticReplyOptions,
  AutocompleteContext,
  AutocompleteHandler,
  AutocompleteResult,
  AutocompleteChoice,
} from "./context.js";

// Container / services
export { Container, type ServiceDefinition, type ServiceMap } from "./container.js";

// Registry
export { Registry, type Registrable } from "./registry.js";

// Intents
export { computeIntents, type ComputedIntents } from "./intents.js";

// Deploy
export {
  deployCommands,
  clearCommands,
  planDeployment,
  buildCommandTree,
  commandToJSON,
  type DeployOptions,
  type DeployResult,
  type DeployTargetResult,
  type DeploymentPlan,
  type ClearOptions,
} from "./deploy.js";

// customId codec
export { encodeCustomId, decodeCustomId, customIdKey } from "./customId.js";

// Errors
export { BotError, isBotError, ERROR_CATALOGUE, type ErrorCode, type BotErrorOptions } from "./errors.js";

// Logger
export { Logger, createLogger, type LogLevel, type LoggerOptions } from "./logger.js";

// Constants
export { VERSION, FRAMEWORK_NAME, CUSTOM_ID_MAX_LENGTH } from "./constants.js";

// Formatting helpers (mentions, emojis, timestamps, allowed-mentions)
export { mention, emoji, timestamp, allowedMentions, TimestampStyles } from "./format.js";

// Component builders (rows + Components V2) and smart caching/resolution
export { ui } from "./ui.js";
export { TTLCache, createCache, resolve, type TTLCacheOptions } from "./cache.js";

// Interactive helpers
export {
  paginate,
  confirm,
  type PaginateOptions,
  type ConfirmOptions,
} from "./pagination.js";

// Asset URLs & voice-state helpers
export { assets, type ImageOptions } from "./assets.js";
export { voice } from "./voice.js";

// Sharding
export { isShardChild, normalizeSharding, launchShardManager, type ShardingOptions } from "./sharding.js";

// Internationalisation
export { createI18n, type I18n, type I18nOptions, type Messages } from "./i18n.js";

// Persistence (key-value stores)
export {
  memoryStore,
  sqliteStore,
  defineStore,
  type KVStore,
} from "./store.js";

// Audit trail
export {
  createAuditLog,
  memoryAuditSink,
  storeAuditSink,
  loggerAuditSink,
  type AuditLog,
  type AuditEntry,
  type AuditSink,
  type AuditFilter,
  type AuditLogOptions,
} from "./audit.js";

// Feature flags
export {
  createFeatureFlags,
  featureEnabled,
  type FeatureFlags,
  type FeatureFlagsOptions,
  type FlagScope,
} from "./flags.js";

// Health / metrics HTTP server
export { startHealthServer, type HealthStatus, type HealthOptions } from "./health.js";

// Resilience (rate limiting, circuit breaking, retry, timeout)
export {
  createRateLimiter,
  rateLimit,
  RateLimiter,
  createCircuitBreaker,
  CircuitBreaker,
  CircuitOpenError,
  retry,
  timeout,
  type RateLimiterOptions,
  type RateLimitResult,
  type CircuitBreakerOptions,
  type CircuitState,
  type RetryOptions,
} from "./resilience.js";

// Convenience re-exports of the discord.js enums & builders used most.
export {
  ButtonStyle,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  GatewayIntentBits,
  MessageFlags,
  ActivityType,
  Colors,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  Collection,
} from "discord.js";
