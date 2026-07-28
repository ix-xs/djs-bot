/**
 * Command diff deployer.
 *
 * Instead of blindly PUTting commands on every start (and eating rate limits),
 * this builds the desired command tree from the registry, fetches what Discord
 * currently has, and only pushes when they differ — reporting exactly what was
 * added, removed or changed. Supports `--dry-run` and guild vs global targets.
 *
 * @module deploy
 */
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  PermissionsBitField,
  REST,
  Routes,
  type RESTPostAPIApplicationCommandsJSONBody,
  type PermissionResolvable,
} from "discord.js";
import type { AnyOption, OptionKind, OptionMap } from "./schema.js";
import type {
  CommandDefinition,
  InstallContext,
  InteractionContext,
  MessageCommandDefinition,
  SubcommandDefinition,
  UserCommandDefinition,
} from "./definitions.js";
import type { Registry } from "./registry.js";
import type { Logger } from "./logger.js";

const OPTION_TYPE: Record<OptionKind, ApplicationCommandOptionType> = {
  string: ApplicationCommandOptionType.String,
  integer: ApplicationCommandOptionType.Integer,
  number: ApplicationCommandOptionType.Number,
  boolean: ApplicationCommandOptionType.Boolean,
  user: ApplicationCommandOptionType.User,
  member: ApplicationCommandOptionType.User, // members arrive as users; resolved at runtime
  channel: ApplicationCommandOptionType.Channel,
  role: ApplicationCommandOptionType.Role,
  mentionable: ApplicationCommandOptionType.Mentionable,
  attachment: ApplicationCommandOptionType.Attachment,
};

function optionToJSON(name: string, opt: AnyOption): Record<string, unknown> {
  const cfg = opt.config as Record<string, unknown>;
  const json: Record<string, unknown> = {
    type: OPTION_TYPE[opt.kind],
    name,
    description: opt.description,
    required: opt.required,
  };
  if (cfg.choices) json.choices = cfg.choices;
  if (cfg.minLength !== undefined) json.min_length = cfg.minLength;
  if (cfg.maxLength !== undefined) json.max_length = cfg.maxLength;
  if (cfg.min !== undefined) json.min_value = cfg.min;
  if (cfg.max !== undefined) json.max_value = cfg.max;
  if (cfg.channelTypes) json.channel_types = cfg.channelTypes;
  if (cfg.autocomplete) json.autocomplete = true;
  if (cfg.nameLocalizations) json.name_localizations = cfg.nameLocalizations;
  if (cfg.descriptionLocalizations) json.description_localizations = cfg.descriptionLocalizations;
  return json;
}

function optionsToJSON(options: OptionMap): Record<string, unknown>[] {
  return Object.entries(options).map(([name, opt]) => optionToJSON(name, opt));
}

function subcommandToJSON(name: string, sub: SubcommandDefinition): Record<string, unknown> {
  const json: Record<string, unknown> = {
    type: ApplicationCommandOptionType.Subcommand,
    name,
    description: sub.description,
    options: optionsToJSON(sub.options),
  };
  if (sub.nameLocalizations) json.name_localizations = sub.nameLocalizations;
  if (sub.descriptionLocalizations) json.description_localizations = sub.descriptionLocalizations;
  return json;
}

/** Converts one slash command definition to the REST JSON body Discord expects. */
export function commandToJSON(command: CommandDefinition): RESTPostAPIApplicationCommandsJSONBody {
  let options: Record<string, unknown>[] = [];
  if (command.groups || command.subcommands) {
    if (command.groups) {
      for (const [groupName, group] of Object.entries(command.groups)) {
        options.push({
          type: ApplicationCommandOptionType.SubcommandGroup,
          name: groupName,
          description: group.description,
          options: Object.entries(group.subcommands).map(([n, s]) => subcommandToJSON(n, s)),
        });
      }
    }
    if (command.subcommands) {
      for (const [n, sub] of Object.entries(command.subcommands)) options.push(subcommandToJSON(n, sub));
    }
  } else {
    options = optionsToJSON(command.options);
  }

  const body: Record<string, unknown> = {
    type: ApplicationCommandType.ChatInput,
    name: command.name,
    description: command.description,
    options,
  };
  if (command.nsfw !== undefined) body.nsfw = command.nsfw;
  if (command.nameLocalizations) body.name_localizations = command.nameLocalizations;
  if (command.descriptionLocalizations) body.description_localizations = command.descriptionLocalizations;
  applyPermissions(body, command.dmPermission, command.defaultMemberPermissions);
  applyInstall(body, command.integrationTypes, command.contexts);
  return body as unknown as RESTPostAPIApplicationCommandsJSONBody;
}

/** Converts a context-menu (user/message) command to its REST JSON body. */
export function contextCommandToJSON(
  command: UserCommandDefinition | MessageCommandDefinition,
): RESTPostAPIApplicationCommandsJSONBody {
  const body: Record<string, unknown> = {
    type: command.kind === "userCommand" ? ApplicationCommandType.User : ApplicationCommandType.Message,
    name: command.name,
    // Context-menu commands must have an empty description.
    description: "",
  };
  if (command.nameLocalizations) body.name_localizations = command.nameLocalizations;
  applyPermissions(body, command.dmPermission, command.defaultMemberPermissions);
  applyInstall(body, command.integrationTypes, command.contexts);
  return body as unknown as RESTPostAPIApplicationCommandsJSONBody;
}

const INTEGRATION_TYPE: Record<InstallContext, ApplicationIntegrationType> = {
  guild: ApplicationIntegrationType.GuildInstall,
  user: ApplicationIntegrationType.UserInstall,
};
const CONTEXT_TYPE: Record<InteractionContext, InteractionContextType> = {
  guild: InteractionContextType.Guild,
  botDm: InteractionContextType.BotDM,
  privateChannel: InteractionContextType.PrivateChannel,
};

function applyPermissions(
  body: Record<string, unknown>,
  dmPermission: boolean | undefined,
  defaultMemberPermissions: PermissionResolvable | undefined,
): void {
  if (dmPermission !== undefined) body.dm_permission = dmPermission;
  if (defaultMemberPermissions !== undefined) {
    body.default_member_permissions = new PermissionsBitField(defaultMemberPermissions).bitfield.toString();
  }
}

function applyInstall(
  body: Record<string, unknown>,
  integrationTypes: readonly InstallContext[] | undefined,
  contexts: readonly InteractionContext[] | undefined,
): void {
  if (integrationTypes) body.integration_types = integrationTypes.map((t) => INTEGRATION_TYPE[t]);
  if (contexts) body.contexts = contexts.map((c) => CONTEXT_TYPE[c]);
}

/** One command's REST body together with its deploy target (global, or guilds). */
interface CommandEntry {
  json: RESTPostAPIApplicationCommandsJSONBody;
  guilds?: readonly string[];
}

function commandEntries(registry: Registry): CommandEntry[] {
  return [
    ...[...registry.commands.values()].map((c) => ({ json: commandToJSON(c), guilds: c.guilds })),
    ...[...registry.userCommands.values()].map((c) => ({ json: contextCommandToJSON(c), guilds: c.guilds })),
    ...[...registry.messageCommands.values()].map((c) => ({ json: contextCommandToJSON(c), guilds: c.guilds })),
  ];
}

/** Builds the full desired command tree (ignoring per-command scoping). */
export function buildCommandTree(registry: Registry): RESTPostAPIApplicationCommandsJSONBody[] {
  return commandEntries(registry).map((e) => e.json);
}

/** A resolved deployment plan: which commands go global, and which go to which guild. */
export interface DeploymentPlan {
  /** Commands deployed globally (no `guilds` restriction). */
  global: RESTPostAPIApplicationCommandsJSONBody[];
  /** Commands per guild id (from each command's `guilds`). */
  guilds: Map<string, RESTPostAPIApplicationCommandsJSONBody[]>;
}

/**
 * Partitions the registry's commands into a global set and per-guild sets based
 * on each command's `guilds` field. A command with no `guilds` is global; one
 * listing guild ids is deployed to exactly those guilds.
 */
export function planDeployment(registry: Registry): DeploymentPlan {
  const global: RESTPostAPIApplicationCommandsJSONBody[] = [];
  const guilds = new Map<string, RESTPostAPIApplicationCommandsJSONBody[]>();
  for (const entry of commandEntries(registry)) {
    if (entry.guilds && entry.guilds.length > 0) {
      for (const guildId of entry.guilds) {
        const list = guilds.get(guildId) ?? [];
        list.push(entry.json);
        guilds.set(guildId, list);
      }
    } else {
      global.push(entry.json);
    }
  }
  return { global, guilds };
}

/** Options for {@link deployCommands}. */
export interface DeployOptions {
  /** Bot token. */
  token: string;
  /** Application (client) id. */
  clientId: string;
  /**
   * Force **every** command onto this single guild (instant), ignoring per-command
   * scoping. Used in development for fast local testing.
   */
  guildId?: string;
  /**
   * Guild ids previously deployed to. Any that are no longer targeted by the
   * current plan get their commands cleared (auto-prune). The {@link Bot}
   * tracks these for you in a small state file.
   */
  knownGuilds?: readonly string[];
  /** Compute the diff but do not push. */
  dryRun?: boolean;
  /** Optional logger for progress output. */
  logger?: Logger;
}

/** What changed for one deploy target (global, or a specific guild). */
export interface DeployTargetResult {
  scope: "global" | "guild";
  guildId?: string;
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
  /** Whether a write to Discord actually happened for this target. */
  applied: boolean;
}

/** The outcome of a deploy across all targets. */
export interface DeployResult {
  /** One entry per target that was reconciled (global and/or guilds). */
  targets: DeployTargetResult[];
  /** Whether any target was written. */
  applied: boolean;
  /** Guild ids the current plan targets (for state tracking / auto-prune). */
  deployedGuilds: string[];
}

/** A stable key that distinguishes commands of the same name but different type. */
function commandKey(cmd: Record<string, unknown>): string {
  return `${(cmd.type as number) ?? ApplicationCommandType.ChatInput}:${cmd.name as string}`;
}

function canonical(cmd: RESTPostAPIApplicationCommandsJSONBody): string {
  // Stable stringify of the fields that matter for equality.
  const pick = (c: Record<string, unknown>): unknown => ({
    type: c.type ?? ApplicationCommandType.ChatInput,
    name: c.name,
    description: c.description ?? "",
    default_member_permissions: c.default_member_permissions ?? null,
    dm_permission: c.dm_permission ?? null,
    integration_types: (c.integration_types as unknown[]) ?? null,
    contexts: (c.contexts as unknown[]) ?? null,
    name_localizations: c.name_localizations ?? null,
    description_localizations: c.description_localizations ?? null,
    nsfw: c.nsfw ?? false,
    options: ((c.options as Array<Record<string, unknown>>) ?? []).map((o) => ({
      type: o.type,
      name: o.name,
      description: o.description ?? "",
      required: o.required ?? false,
      choices: o.choices ?? null,
      min_value: o.min_value ?? null,
      max_value: o.max_value ?? null,
      min_length: o.min_length ?? null,
      max_length: o.max_length ?? null,
      channel_types: o.channel_types ?? null,
      autocomplete: o.autocomplete ?? false,
    })),
  });
  return JSON.stringify(pick(cmd as unknown as Record<string, unknown>));
}

/** Reconciles one target (global or a single guild): fetch, diff, and PUT if changed. */
async function reconcileTarget(
  rest: REST,
  clientId: string,
  guildId: string | undefined,
  desired: RESTPostAPIApplicationCommandsJSONBody[],
  dryRun: boolean,
  logger?: Logger,
): Promise<DeployTargetResult> {
  const scope: "global" | "guild" = guildId ? "guild" : "global";
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  const existing = (await rest.get(route)) as Array<Record<string, unknown> & { name: string }>;
  const existingByKey = new Map(existing.map((c) => [commandKey(c), c]));
  const desiredByKey = new Map(desired.map((c) => [commandKey(c as unknown as Record<string, unknown>), c]));

  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];

  for (const [key, cmd] of desiredByKey) {
    const prev = existingByKey.get(key);
    const name = (cmd as unknown as { name: string }).name;
    if (!prev) added.push(name);
    else if (canonical(cmd) !== canonical(prev as unknown as RESTPostAPIApplicationCommandsJSONBody)) changed.push(name);
    else unchanged.push(name);
  }
  for (const [key, cmd] of existingByKey) {
    if (!desiredByKey.has(key)) removed.push(cmd.name);
  }

  const dirty = added.length > 0 || changed.length > 0 || removed.length > 0;
  const result: DeployTargetResult = { scope, guildId, added, removed, changed, unchanged, applied: false };

  if (!dirty) {
    logger?.info({ scope, guildId, commands: desired.length }, "Commands already up to date");
    return result;
  }
  if (dryRun) {
    logger?.info({ scope, guildId, added, changed, removed }, "Dry run — no changes pushed");
    return result;
  }
  await rest.put(route, { body: desired });
  result.applied = true;
  logger?.info({ scope, guildId, added, changed, removed }, "Commands deployed");
  return result;
}

/**
 * Deploys commands, honouring per-command scoping:
 *  - commands with no `guilds` go **global**,
 *  - commands with `guilds` go to **those guilds**.
 *
 * Each target is diffed independently and pushed only if it changed. Pass
 * `guildId` to instead force every command onto one guild (fast dev testing).
 *
 * @example
 * // Production: global commands globally, scoped commands to their guilds.
 * const result = await deployCommands(registry, { token, clientId });
 * @example
 * // Dev: everything onto one guild, instantly.
 * await deployCommands(registry, { token, clientId, guildId: devGuildId });
 */
export async function deployCommands(registry: Registry, options: DeployOptions): Promise<DeployResult> {
  const rest = new REST().setToken(options.token);
  const dryRun = options.dryRun ?? false;
  const targets: DeployTargetResult[] = [];
  let deployedGuilds: string[] = [];

  if (options.guildId) {
    // Force everything onto one guild (dev), ignoring per-command scoping.
    const desired = buildCommandTree(registry);
    targets.push(await reconcileTarget(rest, options.clientId, options.guildId, desired, dryRun, options.logger));
    deployedGuilds = [options.guildId];
  } else {
    const plan = planDeployment(registry);
    targets.push(await reconcileTarget(rest, options.clientId, undefined, plan.global, dryRun, options.logger));
    for (const [guildId, commands] of plan.guilds) {
      targets.push(await reconcileTarget(rest, options.clientId, guildId, commands, dryRun, options.logger));
    }
    deployedGuilds = [...plan.guilds.keys()];

    // Auto-prune: clear commands in guilds we deployed to before but no longer target.
    const stale = (options.knownGuilds ?? []).filter((g) => !plan.guilds.has(g));
    for (const guildId of stale) {
      options.logger?.info({ guildId }, "Pruning commands from no-longer-targeted guild");
      targets.push(await reconcileTarget(rest, options.clientId, guildId, [], dryRun, options.logger));
    }
  }

  return { targets, applied: targets.some((t) => t.applied), deployedGuilds };
}

/** Options for {@link clearCommands}. */
export interface ClearOptions {
  token: string;
  clientId: string;
  /** Clear a specific guild's commands; omit to clear **global** commands. */
  guildId?: string;
  dryRun?: boolean;
  logger?: Logger;
}

/**
 * Removes **all** of the app's commands from one scope (a guild, or global).
 * @example await clearCommands({ token, clientId, guildId }); // wipe a guild
 */
export async function clearCommands(options: ClearOptions): Promise<DeployTargetResult> {
  const rest = new REST().setToken(options.token);
  return reconcileTarget(rest, options.clientId, options.guildId, [], options.dryRun ?? false, options.logger);
}
