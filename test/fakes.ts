/**
 * A minimal stand-in for a discord.js interaction, faithful to the one rule
 * that matters for the reply helpers: an interaction can be acknowledged only
 * once, and what is valid afterwards depends on how.
 */
export interface Call {
  method: string;
  payload?: unknown;
}

export interface FakeOptions {
  kind?: "command" | "button" | "select" | "modal" | "userCommand";
  commandName?: string;
  customId?: string;
  subcommand?: string | null;
  group?: string | null;
  strings?: Record<string, string>;
  userId?: string;
  guildId?: string | null;
  locale?: string;
  fields?: Record<string, unknown>;
}

export function fakeInteraction(options: FakeOptions = {}) {
  const kind = options.kind ?? "command";
  const calls: Call[] = [];
  const record = (method: string, payload?: unknown) => calls.push(payload === undefined ? { method } : { method, payload });
  const acknowledgedTwice = () => new Error("InteractionAlreadyReplied");

  const interaction = {
    calls,
    replied: false,
    deferred: false,
    locale: options.locale ?? "en",
    user: { id: options.userId ?? "user-1", tag: "user#0001" },
    guild: null,
    guildId: options.guildId ?? null,
    channel: null,
    channelId: "channel-1",
    member: null,
    memberPermissions: null,
    appPermissions: null,
    commandName: options.commandName ?? "ping",
    customId: options.customId ?? "",
    values: [] as string[],
    message: { components: [] as unknown[] },
    fields: options.fields ?? {},
    targetUser: { id: "target-1" },
    options: {
      getSubcommand: () => options.subcommand ?? null,
      getSubcommandGroup: () => options.group ?? null,
      getString: (name: string) => options.strings?.[name] ?? null,
      getInteger: () => null,
      getNumber: () => null,
      getBoolean: () => null,
      getUser: () => null,
      getMember: () => null,
      getChannel: () => null,
      getRole: () => null,
      getMentionable: () => null,
      getAttachment: () => null,
    },

    isChatInputCommand: () => kind === "command",
    isAutocomplete: () => false,
    isUserContextMenuCommand: () => kind === "userCommand",
    isMessageContextMenuCommand: () => false,
    isButton: () => kind === "button",
    isAnySelectMenu: () => kind === "select",
    isUserSelectMenu: () => false,
    isRoleSelectMenu: () => false,
    isChannelSelectMenu: () => false,
    isMentionableSelectMenu: () => false,
    isModalSubmit: () => kind === "modal",
    isMessageComponent: () => kind === "button" || kind === "select",
    inCachedGuild: () => false,

    async reply(payload: unknown) {
      if (interaction.replied || interaction.deferred) throw acknowledgedTwice();
      interaction.replied = true;
      record("reply", payload);
    },
    async deferReply(payload: unknown) {
      if (interaction.replied || interaction.deferred) throw acknowledgedTwice();
      interaction.deferred = true;
      record("deferReply", payload);
    },
    async editReply(payload: unknown) {
      if (!interaction.replied && !interaction.deferred) throw new Error("InteractionNotReplied");
      interaction.replied = true;
      record("editReply", payload);
    },
    async followUp(payload: unknown) {
      if (!interaction.replied && !interaction.deferred) throw new Error("InteractionNotReplied");
      interaction.replied = true;
      record("followUp", payload);
    },
    async update(payload: unknown) {
      if (interaction.replied || interaction.deferred) throw acknowledgedTwice();
      interaction.replied = true;
      record("update", payload);
    },
    async deferUpdate() {
      if (interaction.replied || interaction.deferred) throw acknowledgedTwice();
      interaction.deferred = true;
      record("deferUpdate");
    },
    async showModal(payload: unknown) {
      if (interaction.replied || interaction.deferred) throw acknowledgedTwice();
      interaction.replied = true;
      record("showModal", payload);
    },
    async fetchReply() {
      record("fetchReply");
      return { id: "reply-1" };
    },
    async deleteReply() {
      record("deleteReply");
    },
  };
  return interaction;
}

export type FakeInteraction = ReturnType<typeof fakeInteraction>;

export const methods = (interaction: FakeInteraction): string[] => interaction.calls.map((call) => call.method);
