/**
 * Live checks: the framework against the real Discord API, no clicking needed.
 *
 *   npm run live
 *
 * Reads DISCORD_TOKEN, DISCORD_CLIENT_ID and DISCORD_DEV_GUILD from the
 * environment or `.env`. Set DISCORD_TEST_CHANNEL to a text channel of that
 * server to also send (and delete) one message per kind of payload.
 *
 * What it does to your test server, and nothing else:
 *  - replaces the server's commands for the duration of the run, then puts back
 *    exactly what was there (global commands are never touched);
 *  - posts messages in DISCORD_TEST_CHANNEL and deletes each of them.
 *
 * Use a server you test in, not a community.
 */
import {
  AttachmentBuilder,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  type Message,
} from "discord.js";
import {
  ButtonStyle,
  Colors,
  Registry,
  defineBot,
  defineButton,
  defineCommand,
  defineMessageCommand,
  definePlugin,
  defineSelectMenu,
  defineUserCommand,
  defineUserSelect,
  deployCommands,
  env,
  loadEnvFile,
  p,
  s,
  subcommand,
  ui,
  VERSION,
  type DeployResult,
} from "../../src/index.js";

import { closeRestConnections } from "../../src/deploy.js";

loadEnvFile();

const C = { reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", gray: "\x1b[90m", bold: "\x1b[1m" };
const results: Array<{ name: string; ok: boolean; note?: string }> = [];

/** Runs one check, records the outcome and carries on whatever happens. */
async function check(name: string, run: () => Promise<string | void>): Promise<boolean> {
  try {
    const note = (await run()) ?? undefined;
    results.push({ name, ok: true, note });
    console.log(`${C.green}✓${C.reset} ${name}${note ? ` ${C.gray}${note}${C.reset}` : ""}`);
    return true;
  } catch (error) {
    const note = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, note });
    console.log(`${C.red}✗${C.reset} ${name}\n  ${C.red}${note}${C.reset}`);
    return false;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** A change summary such as "+3 ~1 -0", or "no changes". */
function summarise(result: DeployResult): string {
  const [target] = result.targets;
  if (!target) return "no target";
  const { added, changed, removed } = target;
  return added.length + changed.length + removed.length === 0
    ? "no changes"
    : `+${added.length} ~${changed.length} -${removed.length}`;
}

/* -------------------------------------------------------------------------- */
/*  The command set: one of everything the deployer has to serialise          */
/* -------------------------------------------------------------------------- */

function commandSet(topicDescription = "What to look up") {
  const basic = defineCommand({
    name: "lt-basic",
    description: "Live test: every option type",
    nameLocalizations: { fr: "lt-base" },
    descriptionLocalizations: { fr: "Test réel : tous les types d'option" },
    contexts: ["guild"],
    integrationTypes: ["guild"],
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    options: {
      // Declared optional-first on purpose: the deployer must reorder them.
      note: s.string({ description: "A note", maxLength: 200, descriptionLocalizations: { fr: "Une note" } }),
      plan: s.string({
        description: "A plan",
        required: true,
        choices: [
          { name: "Free", value: "free" },
          { name: "Pro", value: "pro" },
        ],
      }),
      amount: s.integer({ description: "An amount", min: 1, max: 100 }),
      ratio: s.number({ description: "A ratio", min: 0, max: 1 }),
      loud: s.boolean({ description: "A flag" }),
      who: s.user({ description: "A user" }),
      where: s.channel({ description: "A channel", channelTypes: [ChannelType.GuildText, ChannelType.GuildVoice] }),
      rank: s.role({ description: "A role" }),
      anyone: s.mentionable({ description: "A user or a role" }),
      proof: s.attachment({ description: "A file", fileTypes: ["image", ".pdf"] }),
    },
    run: () => undefined,
  });

  const auto = defineCommand({
    name: "lt-auto",
    description: "Live test: autocomplete",
    options: { query: s.string({ description: "Search", required: true, autocomplete: () => [] }) },
    run: () => undefined,
  });

  const tree = defineCommand({
    name: "lt-tree",
    description: "Live test: subcommands and groups",
    subcommands: {
      view: subcommand({ description: "View", run: () => undefined }),
      find: subcommand({
        description: "Find",
        options: { topic: s.string({ description: topicDescription, required: true }) },
        run: () => undefined,
      }),
    },
    groups: {
      role: {
        description: "Role settings",
        subcommands: {
          add: subcommand({
            description: "Add a role",
            options: { role: s.role({ description: "The role", required: true }) },
            run: () => undefined,
          }),
        },
      },
    },
  });

  const user = defineUserCommand({ name: "LT user", run: () => undefined });
  const message = defineMessageCommand({ name: "LT message", run: () => undefined });

  const registry = new Registry();
  registry.addAll([basic, auto, tree, user, message]);
  return registry;
}

/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  console.log(`${C.bold}djs-bot live checks${C.reset} ${C.gray}v${VERSION}${C.reset}\n`);

  const token = env("DISCORD_TOKEN");
  const clientId = env("DISCORD_CLIENT_ID");
  const guildId = env("DISCORD_DEV_GUILD");
  const channelId = env.optional("DISCORD_TEST_CHANNEL");
  const rest = new REST().setToken(token);
  const guildRoute = Routes.applicationGuildCommands(clientId, guildId);

  const identified = await check("the token is valid and belongs to DISCORD_CLIENT_ID", async () => {
    const app = (await rest.get(Routes.currentApplication())) as { id: string; name: string };
    assert(app.id === clientId, `the token belongs to application ${app.id}, not ${clientId}`);
    return app.name;
  });
  if (!identified) return finish();

  /* ------------------------------ deployment ----------------------------- */

  let snapshot: unknown[] | undefined;
  await check("snapshot the server's current commands", async () => {
    snapshot = (await rest.get(guildRoute, { query: new URLSearchParams({ with_localizations: "true" }) })) as unknown[];
    return `${snapshot.length} command(s) saved`;
  });
  if (!snapshot) return finish();

  try {
    const deploy = (registry: Registry, dryRun = false) =>
      deployCommands(registry, { token, clientId, guildId, dryRun });

    await check("deploy: every option type, localizations, subcommands, context menus", async () => {
      const result = await deploy(commandSet());
      const names = [...result.targets[0]!.added, ...result.targets[0]!.changed, ...result.targets[0]!.unchanged];
      for (const expected of ["lt-basic", "lt-auto", "lt-tree", "LT user", "LT message"]) {
        assert(names.includes(expected), `Discord did not accept "${expected}"`);
      }
      return summarise(result);
    });

    await check("deploy again: Discord's defaults and localizations are not seen as changes", async () => {
      const result = await deploy(commandSet());
      const target = result.targets[0]!;
      assert(
        target.added.length + target.changed.length + target.removed.length === 0,
        `expected no changes, got added=[${target.added}] changed=[${target.changed}] removed=[${target.removed}]`,
      );
      assert(!result.applied, "nothing changed, yet a write was sent");
      return summarise(result);
    });

    await check("deploy: Discord stored required options first and kept the file type filter", async () => {
      const live = (await rest.get(guildRoute)) as Array<{ name: string; options?: Array<Record<string, unknown>> }>;
      const basic = live.find((command) => command.name === "lt-basic");
      assert(basic?.options, "lt-basic is missing");
      assert(basic.options[0]!.name === "plan", `the first option is "${basic.options[0]!.name}", expected the required "plan"`);
      const proof = basic.options.find((option) => option.name === "proof");
      assert(
        JSON.stringify(proof?.file_types) === JSON.stringify(["image", ".pdf"]),
        `file_types came back as ${JSON.stringify(proof?.file_types)}`,
      );
    });

    await check("dry run: reports a nested change without pushing it", async () => {
      const result = await deploy(commandSet("Something else entirely"), true);
      const target = result.targets[0]!;
      assert(target.changed.join() === "lt-tree", `expected only lt-tree to change, got [${target.changed}]`);
      assert(!result.applied, "a dry run must not write");
      const after = await deploy(commandSet());
      assert(summarise(after) === "no changes", "the dry run modified Discord");
      return "lt-tree would change";
    });

    await check("deploy: a real change is pushed, and only that command", async () => {
      const result = await deploy(commandSet("Something else entirely"));
      const target = result.targets[0]!;
      assert(target.changed.join() === "lt-tree" && target.added.length === 0, `got ${summarise(result)}`);
      assert(result.applied, "the change was not written");
      return summarise(result);
    });
  } finally {
    await check("restore the server's commands exactly as they were", async () => {
      await rest.put(guildRoute, { body: snapshot });
      const now = (await rest.get(guildRoute)) as unknown[];
      assert(now.length === snapshot!.length, `${now.length} command(s) now, ${snapshot!.length} before`);
      return `${now.length} command(s) back`;
    });
  }

  /* ------------------------------- gateway ------------------------------- */

  let markReady!: () => void;
  const ready = new Promise<void>((resolve) => (markReady = resolve));
  const Ping = defineButton({ id: "lt:ping", params: { n: p.number }, label: "Ping", run: () => undefined });
  const Pick = defineSelectMenu({ id: "lt:pick", run: () => undefined });
  const Who = defineUserSelect({ id: "lt:who", run: () => undefined });

  const bot = defineBot({
    token,
    clientId,
    features: [Ping, Pick, Who],
    intents: "auto",
    deploy: { autoDeploy: false },
    logger: { level: "warn" },
    plugins: [definePlugin({ name: "live-check", setup: (app) => app.hooks.onReady(() => markReady()) })],
  });

  const connected = await check("gateway: the bot logs in and becomes ready", async () => {
    const started = Date.now();
    await bot.start();
    await Promise.race([
      ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("not ready after 30 s")), 30_000)),
    ]);
    assert(bot.client.guilds.cache.has(guildId), `the bot is not a member of server ${guildId}`);
    return `${bot.client.user.tag}, ready in ${Date.now() - started} ms, ${bot.client.guilds.cache.size} server(s)`;
  });

  if (connected && channelId) {
    const channel = await bot.client.channels.fetch(channelId).catch(() => null);
    const sendable = channel?.isSendable() ? channel : undefined;
    await check("the test channel exists and the bot can write in it", async () => {
      assert(sendable, `channel ${channelId} was not found, or is not a channel the bot can send to`);
    });

    if (sendable) {
      /** Sends a payload, lets the check inspect what Discord stored, then deletes it. */
      const roundTrip = async (payload: Parameters<typeof sendable.send>[0], inspect: (message: Message) => void) => {
        const message = await sendable.send(payload);
        try {
          inspect(message);
        } finally {
          await message.delete().catch(() => undefined);
        }
      };
      const avatar = bot.client.user.displayAvatarURL({ size: 128 });

      await check("message: embed", () =>
        roundTrip({ embeds: [new EmbedBuilder().setTitle("djs-bot live check").setColor(Colors.Blurple)] }, (m) =>
          assert(m.embeds[0]?.title === "djs-bot live check", "the embed did not come back"),
        ),
      );

      await check("message: routed button (typed customId), link button, selects", () =>
        roundTrip(
          {
            content: "components",
            components: [
              ui.row(Ping.build({ n: 42 }, { style: ButtonStyle.Success }), ui.linkButton("Docs", "https://ix-xs.github.io/djs-bot/")),
              ui.row(Pick.build(undefined, { placeholder: "Pick", options: [{ label: "A", value: "a" }] })),
              ui.row(Who.build(undefined, { placeholder: "Who", maxValues: 2 })),
            ],
          },
          (m) => {
            assert(m.components.length === 3, `${m.components.length} rows came back, expected 3`);
            const button = m.resolveComponent(Ping.build({ n: 42 }).toJSON().custom_id);
            assert(button?.type === ComponentType.Button, "the routed button was not stored with its customId");
          },
        ),
      );

      await check("message: Components V2 container, section, gallery, separator, row", () =>
        roundTrip(
          {
            flags: MessageFlags.IsComponentsV2,
            components: [
              ui.container(
                { accent: Colors.Blurple },
                ui.text("## djs-bot live check\nComponents V2"),
                ui.separator({ divider: true, spacing: "large" }),
                ui.section({ text: ["A section", "with two lines"], accessory: ui.thumbnail(avatar, "avatar") }),
                ui.gallery(avatar),
                ui.row(Ping.build({ n: 1 })),
              ),
            ],
          },
          (m) => {
            assert(m.flags.has(MessageFlags.IsComponentsV2), "the V2 flag is missing");
            assert(m.components[0]?.type === ComponentType.Container, "the container did not come back");
          },
        ),
      );

      await check("message: attachment shown by a V2 file component", () =>
        roundTrip(
          {
            flags: MessageFlags.IsComponentsV2,
            files: [new AttachmentBuilder(Buffer.from("djs-bot live check"), { name: "note.txt" })],
            components: [ui.container(ui.text("A file:"), ui.file("attachment://note.txt"))],
          },
          (m) => assert(m.attachments.size === 1, "the attachment is missing"),
        ),
      );

      await check("message: native poll", () =>
        roundTrip({ poll: ui.poll("Does it work?", ["Yes", { text: "Also yes", emoji: "✅" }], { hours: 1 }) }, (m) =>
          assert(m.poll?.question.text === "Does it work?" && m.poll.answers.size === 2, "the poll did not come back"),
        ),
      );
    }
  } else if (connected) {
    console.log(`${C.yellow}!${C.reset} DISCORD_TEST_CHANNEL is not set: message payloads were not sent`);
  }

  await check("shutdown: the bot disconnects cleanly", async () => {
    await bot.shutdown();
    let threw = false;
    try {
      void bot.client;
    } catch {
      threw = true;
    }
    assert(threw, "the client is still attached after shutdown");
  });

  await finish();
}

async function finish(): Promise<never> {
  const failed = results.filter((result) => !result.ok);
  console.log(
    failed.length === 0
      ? `\n${C.green}${C.bold}All ${results.length} live checks passed.${C.reset}`
      : `\n${C.red}${C.bold}${failed.length} of ${results.length} live checks failed.${C.reset}`,
  );
  // Close the HTTP pool first: exiting while a socket is mid-close trips an
  // assertion in libuv on Windows.
  await closeRestConnections();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`${C.red}✗ ${error instanceof Error ? error.message : String(error)}${C.reset}`);
  process.exit(1);
});
