import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ButtonStyle, GatewayIntentBits, Partials, PermissionFlagsBits } from "discord.js";
import {
  anyOf,
  botHasPermission,
  commandToJSON,
  commandsEqual,
  computeIntents,
  Container,
  cooldown,
  createRateLimiter,
  DEFAULT_MESSAGES,
  defineButton,
  defineCommand,
  defineEvent,
  defineFeature,
  defineService,
  env,
  guildOwnerOnly,
  hasPermission,
  hasRole,
  inGuild,
  isBotError,
  not,
  oneOf,
  p,
  Registry,
  s,
  subcommand,
  toPrometheus,
  ui,
  VERSION,
} from "../src/index.js";
import { renderMessage } from "../src/messages.js";
import { FILE_SUFFIXES } from "../src/constants.js";
import { createHarness } from "../src/testing.js";

describe("VERSION", () => {
  it("matches package.json, so it cannot drift", () => {
    const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });
});

describe("framework messages", () => {
  it("interpolates the defaults", () => {
    expect(renderMessage(undefined, "cooldown", { seconds: 3 })).toBe("Please wait 3s before doing that again.");
    expect(renderMessage(undefined, "guildOnly", {})).toBe(DEFAULT_MESSAGES.guildOnly);
  });

  it("accepts a template string or a function override", () => {
    expect(renderMessage({ cooldown: "Patiente {seconds}s." }, "cooldown", { seconds: 7 })).toBe("Patiente 7s.");
    expect(renderMessage({ cooldown: ({ seconds }) => `${seconds * 1000} ms` }, "cooldown", { seconds: 2 })).toBe("2000 ms");
  });

  it("leaves an unknown placeholder visible rather than printing 'undefined'", () => {
    expect(renderMessage({ guildOnly: "Hello {nope}" }, "guildOnly", {})).toBe("Hello {nope}");
  });
});

describe("guards", () => {
  const harness = createHarness();
  const command = (guards: Parameters<typeof defineCommand>[0]["guards"]) =>
    defineCommand({ name: "x", description: "x", guards, run: (ctx) => ctx.reply("ran") });

  it("checks the member's permissions and lists only the missing ones, readably", async () => {
    const cmd = command([hasPermission(PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers)]);
    const denied = await harness.command(cmd, { guildId: "g", permissions: [PermissionFlagsBits.KickMembers] });
    expect(denied.passedGuards).toBe(false);
    expect(denied.rejectionReason).toBe("You need: Ban Members.");

    const allowed = await harness.command(cmd, {
      guildId: "g",
      permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers],
    });
    expect(allowed.passedGuards).toBe(true);
  });

  it("checks the bot's permissions in the channel", async () => {
    const cmd = command([botHasPermission(PermissionFlagsBits.ManageMessages)]);
    const denied = await harness.command(cmd, { guildId: "g", botPermissions: [] });
    expect(denied.rejectionReason).toBe("I need: Manage Messages.");
    expect((await harness.command(cmd, { guildId: "g" })).passedGuards).toBe(true);
  });

  it("speaks the configured language", async () => {
    const result = await harness.command(command([inGuild()]), { messages: { guildOnly: "Sur un serveur uniquement." } });
    expect(result.rejectionReason).toBe("Sur un serveur uniquement.");
  });

  it("combines with anyOf and not", async () => {
    const staff = anyOf(hasRole("mod"), hasRole("admin"));
    expect((await harness.command(command([staff]), { guildId: "g", roles: ["admin"] })).passedGuards).toBe(true);
    expect((await harness.command(command([staff]), { guildId: "g", roles: ["member"] })).passedGuards).toBe(false);

    const notInGuild = not(inGuild(), "DMs only, please.");
    expect((await harness.command(command([notInGuild]))).passedGuards).toBe(true);
    expect((await harness.command(command([notInGuild]), { guildId: "g" })).rejectionReason).toBe("DMs only, please.");
  });

  it("restricts to the server owner", async () => {
    expect((await harness.command(command([guildOwnerOnly()]), { guildId: "g" })).passedGuards).toBe(false);
  });

  it("enforces a cooldown per user and reports the wait", async () => {
    const cmd = command([cooldown("10s")]);
    expect((await harness.command(cmd, { userId: "a" })).passedGuards).toBe(true);
    const second = await harness.command(cmd, { userId: "a" });
    expect(second.rejectionReason).toBe("Please wait 10s before doing that again.");
    expect((await harness.command(cmd, { userId: "b" })).passedGuards).toBe(true);
  });
});

describe("rate limiter", () => {
  it("forgets finished windows instead of growing forever", async () => {
    const limiter = createRateLimiter({ limit: 1, window: 1 });
    for (let i = 0; i < 999; i++) limiter.consume(`user-${i}`);
    expect(limiter.size).toBe(999);
    await new Promise((resolve) => setTimeout(resolve, 5));
    limiter.consume("the-1000th"); // triggers the sweep
    expect(limiter.size).toBe(1);
  });
});

describe("harness", () => {
  const harness = createHarness();

  it("targets a subcommand and runs both levels of guards", async () => {
    const cmd = defineCommand({
      name: "config",
      description: "c",
      guards: [inGuild()],
      subcommands: {
        set: subcommand({
          description: "s",
          options: { key: s.string({ required: true }) },
          run: (ctx) => ctx.reply(ctx.options.key),
        }),
      },
    });
    const ok = await harness.command(cmd, { subcommand: "set", guildId: "g", options: { key: "color" } });
    expect(ok.replies).toEqual([{ type: "reply", content: "color" }]);
    expect((await harness.command(cmd, { subcommand: "set" })).passedGuards).toBe(false);
    await expect(harness.command(cmd, { subcommand: "nope" })).rejects.toThrow(/no subcommand "nope"/);
  });

  it("runs an autocomplete handler and maps its result", async () => {
    const cmd = defineCommand({
      name: "play",
      description: "p",
      options: { song: s.string({ autocomplete: (ac) => ["one", "two"].filter((x) => x.startsWith(ac.value)) }) },
      run: () => undefined,
    });
    expect(await harness.autocomplete(cmd, { option: "song", value: "t" })).toEqual([{ name: "two", value: "two" }]);
  });
});

describe("customId params", () => {
  it("types oneOf as a union and falls back to the first value on garbage", () => {
    const codec = oneOf("approve", "reject");
    expect(codec.decode("reject")).toBe("reject");
    expect(codec.decode("tampered")).toBe("approve");
    const Decide = defineButton({ id: "decide", params: { action: p.oneOf("approve", "reject") }, run: () => undefined });
    expect(Decide.build({ action: "reject" }).toJSON()).toMatchObject({ style: ButtonStyle.Primary });
  });
});

describe("deploy diff", () => {
  const local = commandToJSON(
    defineCommand({
      name: "help",
      description: "Show help",
      nameLocalizations: { fr: "aide" },
      options: {
        topic: s.string({ description: "Topic", choices: [{ name: "Setup", value: "setup" }] }),
        page: s.integer({ description: "Page", required: true, min: 1 }),
      },
      run: () => undefined,
    }),
  );

  it("puts required options first, whatever the declaration order", () => {
    expect((local.options ?? []).map((o) => o.name)).toEqual(["page", "topic"]);
  });

  it("treats Discord's defaults and bookkeeping fields as no change", () => {
    // What GET /applications/{id}/commands?with_localizations=true returns.
    const remote = {
      id: "1",
      application_id: "2",
      version: "3",
      type: 1,
      name: "help",
      name_localizations: { fr: "aide" },
      description: "Show help",
      description_localizations: null,
      default_member_permissions: null,
      dm_permission: true,
      contexts: null,
      integration_types: [0],
      nsfw: false,
      options: [
        { type: 4, name: "page", description: "Page", required: true, min_value: 1 },
        {
          type: 3,
          name: "topic",
          description: "Topic",
          choices: [{ name: "Setup", value: "setup", name_localizations: null }],
        },
      ],
    };
    expect(commandsEqual(local, remote)).toBe(true);
  });

  it("still sees a real change, including on a server-defaulted field you set", () => {
    const remote = JSON.parse(JSON.stringify(local)) as Record<string, any>;
    remote.options[1].description = "Old topic";
    expect(commandsEqual(local, remote)).toBe(false);

    const scoped = commandToJSON(
      defineCommand({ name: "dm", description: "d", contexts: ["guild"], run: () => undefined }),
    );
    expect(commandsEqual(scoped, { ...scoped, contexts: [0, 1, 2] })).toBe(false);
    expect(commandsEqual(scoped, { ...scoped, contexts: [0], integration_types: [0], dm_permission: true })).toBe(true);
  });
});

describe("intents", () => {
  const events = [defineEvent("messageCreate", () => undefined)];

  it("lets you add and remove from the derived set", () => {
    const base = computeIntents(events);
    expect(base.privileged).toEqual(["MessageContent"]);

    const tuned = computeIntents(events, {
      add: [GatewayIntentBits.DirectMessages],
      remove: [GatewayIntentBits.MessageContent],
    });
    expect(tuned.privileged).toEqual([]);
    expect(tuned.intents).toContain(GatewayIntentBits.DirectMessages);
    expect(tuned.partials).toContain(Partials.Channel); // DMs need it
  });

  it("knows the newer events", () => {
    const polls = computeIntents([defineEvent("messagePollVoteAdd", () => undefined)]);
    expect(polls.intents).toContain(GatewayIntentBits.GuildMessagePolls);
    const automod = computeIntents([defineEvent("autoModerationActionExecution", () => undefined)]);
    expect(automod.intents).toContain(GatewayIntentBits.AutoModerationExecution);
  });
});

describe("container", () => {
  it("does not mistake a failed factory for a cycle on the next attempt", async () => {
    const container = new Container();
    let attempts = 0;
    container.register(
      defineService("flaky", {
        factory: () => {
          if (++attempts === 1) throw new Error("first try fails");
          return "ready";
        },
      }),
    );
    await expect(container.resolve("flaky")).rejects.toThrow("first try fails");
    expect(await container.resolve("flaky")).toBe("ready");
  });

  it("names the chain of a real cycle", async () => {
    const container = new Container();
    container.register(defineService("a", { deps: ["b"], factory: () => 1 }));
    container.register(defineService("b", { deps: ["a"], factory: () => 2 }));
    await expect(container.resolve("a")).rejects.toThrow("a -> b -> a");
  });

  it("exposes a view that survives await, logging and spreading", async () => {
    const container = new Container();
    container.registerValue("db", { ok: true });
    const view = container.view();
    expect(view).toBe(container.view()); // one proxy, reused
    expect(await view).toBe(view); // probing `then` must not throw
    expect(Object.keys(view)).toEqual(["db"]);
    expect({ ...view }).toEqual({ db: { ok: true } });
    expect("db" in view).toBe(true);
  });

  it("lists the known services when asked for an unknown one", () => {
    const container = new Container();
    container.registerValue("db", {});
    try {
      void container.view().database;
      expect.unreachable();
    } catch (error) {
      expect(isBotError(error) && error.code).toBe("DJSBOT_E031");
      expect((error as { hint: string }).hint).toContain("db");
    }
  });
});

describe("registry", () => {
  it("accepts the same definition twice, from discovery and from a feature", () => {
    const ping = defineCommand({ name: "ping", description: "p", run: () => undefined });
    const registry = new Registry();
    registry.add(ping);
    registry.add(defineFeature({ name: "core", commands: [ping] }));
    expect(registry.commands.size).toBe(1);
  });

  it("still refuses two different commands with one name", () => {
    const registry = new Registry();
    registry.add(defineCommand({ name: "ping", description: "a", run: () => undefined }));
    expect(() => registry.add(defineCommand({ name: "ping", description: "b", run: () => undefined }))).toThrow(
      /Duplicate command name/,
    );
  });
});

describe("loader conventions", () => {
  it("discovers plugin files and no longer trips on guard files", () => {
    expect(FILE_SUFFIXES).toContain(".plugin");
    expect(FILE_SUFFIXES).not.toContain(".guard");
  });
});

describe("env helpers", () => {
  const set = (name: string, value?: string) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  afterEach(() => ["T_NUM", "T_BOOL", "T_LIST"].forEach((name) => set(name)));

  it("reads numbers, and rejects a value that is not one", () => {
    set("T_NUM", "8080");
    expect(env.number("T_NUM")).toBe(8080);
    set("T_NUM");
    expect(env.number("T_NUM", 3000)).toBe(3000);
    expect(() => env.number("T_NUM")).toThrow(/Missing required/);
    set("T_NUM", "eighty");
    expect(() => env.number("T_NUM")).toThrow(/must be a number/);
  });

  it("reads booleans in their usual spellings", () => {
    for (const yes of ["true", "1", "YES", "on"]) {
      set("T_BOOL", yes);
      expect(env.boolean("T_BOOL")).toBe(true);
    }
    set("T_BOOL", "off");
    expect(env.boolean("T_BOOL", true)).toBe(false);
    set("T_BOOL");
    expect(env.boolean("T_BOOL")).toBe(false);
    set("T_BOOL", "maybe");
    expect(() => env.boolean("T_BOOL")).toThrow(/must be a boolean/);
  });

  it("reads comma-separated lists", () => {
    set("T_LIST", " 1, 2 ,,3 ");
    expect(env.list("T_LIST")).toEqual(["1", "2", "3"]);
    set("T_LIST");
    expect(env.list("T_LIST")).toEqual([]);
  });
});

describe("metrics", () => {
  it("renders the Prometheus text format", () => {
    const text = toPrometheus({
      ready: true,
      uptimeMs: 1200,
      metrics: { interactions: 5, handlerAvgMs: 12.5 },
      shard: { id: 2, count: 4 },
    });
    expect(text).toContain('djsbot_ready{shard="2"} 1');
    expect(text).toContain('djsbot_interactions{shard="2"} 5');
    expect(text).toContain('djsbot_handler_avg_ms{shard="2"} 12.5');
    expect(text).toContain("# TYPE djsbot_uptime_ms gauge");
  });
});

describe("ui", () => {
  it("builds a container with an accent colour, or without options", () => {
    expect(ui.container({ accent: 0x5865f2, spoiler: true }, ui.text("hi")).toJSON()).toMatchObject({
      accent_color: 0x5865f2,
      spoiler: true,
      components: [{ content: "hi" }],
    });
    expect(ui.container(ui.text("a"), ui.separator()).toJSON().components).toHaveLength(2);
  });

  it("builds a poll and a premium button", () => {
    expect(ui.poll("Pizza?", ["Yes", { text: "No", emoji: "🥗" }], { hours: 12, multiple: true })).toEqual({
      question: { text: "Pizza?" },
      answers: [{ text: "Yes" }, { text: "No", emoji: "🥗" }],
      duration: 12,
      allowMultiselect: true,
    });
    expect(ui.premiumButton("123456789012345678").toJSON()).toMatchObject({
      style: ButtonStyle.Premium,
      sku_id: "123456789012345678",
    });
  });
});

describe("Discord limits, checked when a command is defined", () => {
  const codeOf = (make: () => unknown): string | undefined => {
    try {
      make();
    } catch (error) {
      return isBotError(error) ? `${error.code}: ${error.message}` : "other";
    }
    return undefined;
  };
  const base = { name: "x", description: "ok", run: () => undefined };

  it("rejects a description that is empty or over 100 characters", () => {
    expect(codeOf(() => defineCommand({ ...base, description: "" }))).toMatch(/E015.*1-100 characters/);
    expect(codeOf(() => defineCommand({ ...base, description: "d".repeat(101) }))).toMatch(/E015/);
    expect(
      codeOf(() => defineCommand({ ...base, options: { a: s.string({ description: "d".repeat(101) }) } })),
    ).toMatch(/E015.*option "a"/);
    // The longest localization is what counts.
    expect(
      codeOf(() => defineCommand({ ...base, descriptionLocalizations: { fr: "d".repeat(101) } })),
    ).toMatch(/E015/);
  });

  it("rejects too many options or choices, and choices combined with autocomplete", () => {
    const many = Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`o${i}`, s.string()]));
    expect(codeOf(() => defineCommand({ ...base, options: many }))).toMatch(/E015.*26 options/);

    const choices = Array.from({ length: 26 }, (_, i) => ({ name: `c${i}`, value: `v${i}` }));
    expect(codeOf(() => defineCommand({ ...base, options: { a: s.string({ choices }) } }))).toMatch(
      /E015.*26 choices.*autocomplete/,
    );
    expect(
      codeOf(() =>
        defineCommand({
          ...base,
          options: { a: s.string({ choices: [{ name: "a", value: "a" }], autocomplete: () => [] }) },
        }),
      ),
    ).toMatch(/E015.*both choices and autocomplete/);
    expect(
      codeOf(() => defineCommand({ ...base, options: { a: s.string({ choices: ["a"] as never }) } })),
    ).toMatch(/E015.*each choice must be { name, value }, got "a"/);
  });

  it("rejects impossible ranges", () => {
    expect(codeOf(() => defineCommand({ ...base, options: { a: s.integer({ min: 5, max: 1 }) } }))).toMatch(/E015.*min/);
    expect(
      codeOf(() => defineCommand({ ...base, options: { a: s.string({ minLength: 10, maxLength: 2 }) } })),
    ).toMatch(/E015.*minLength/);
    expect(codeOf(() => defineCommand({ ...base, options: { a: s.string({ maxLength: 6001 }) } }))).toMatch(/E015/);
  });

  it("checks subcommands too, naming the path", () => {
    expect(
      codeOf(() =>
        defineCommand({
          name: "config",
          description: "c",
          groups: { role: { description: "r", subcommands: { add: subcommand({ description: "", run: () => undefined }) } } },
        }),
      ),
    ).toMatch(/E015.*subcommand "role add"/);
  });

  it("accepts Discord's full name alphabet, including Thai and Devanagari", () => {
    expect(codeOf(() => defineCommand({ ...base, name: "คำสั่ง" }))).toBeUndefined();
    expect(codeOf(() => defineCommand({ ...base, name: "आदेश" }))).toBeUndefined();
    expect(codeOf(() => defineCommand({ ...base, name: "Has Space" }))).toMatch(/E012/);
  });

  it("refuses a scope holding more commands than Discord allows", async () => {
    const { assertScopeLimits } = await import("../src/validate.js");
    const slash = Array.from({ length: 101 }, () => ({ type: 1 }));
    expect(codeOf(() => assertScopeLimits("global", slash))).toMatch(/E015.*101 slash commands in the global scope/);
    expect(codeOf(() => assertScopeLimits("global", slash.slice(0, 100)))).toBeUndefined();
    expect(codeOf(() => assertScopeLimits("guild 1", Array.from({ length: 16 }, () => ({ type: 2 }))))).toMatch(/E015.*16 user/);
  });
});

describe("file type filters", () => {
  it("are sent on attachment options, and compared order-independently", () => {
    const local = commandToJSON(
      defineCommand({
        name: "scan",
        description: "Scan",
        options: { file: s.attachment({ description: "File", required: true, fileTypes: ["image", ".pdf"] }) },
        run: () => undefined,
      }),
    );
    expect((local.options![0] as Record<string, unknown>).file_types).toEqual(["image", ".pdf"]);

    const remote = JSON.parse(JSON.stringify(local)) as Record<string, any>;
    remote.options[0].file_types = [".pdf", "image"];
    expect(commandsEqual(local, remote)).toBe(true);
    remote.options[0].file_types = ["video"];
    expect(commandsEqual(local, remote)).toBe(false);
  });

  it("reject a malformed entry and more than ten of them", () => {
    const attempt = (fileTypes: string[]) => () =>
      defineCommand({ name: "x", description: "x", options: { f: s.attachment({ fileTypes: fileTypes as never }) }, run: () => undefined });
    expect(attempt(["pdf"])).toThrow(/not a valid file type/);
    expect(attempt(Array.from({ length: 11 }, (_, i) => `.e${i}`))).toThrow(/11 file types/);
  });
});

describe("isHiddenChannel", () => {
  it("recognises a channel Discord withheld, by flag or by placeholder name", async () => {
    const { isHiddenChannel } = await import("../src/index.js");
    expect(isHiddenChannel({ flags: { bitfield: 1 << 17 }, name: "general" })).toBe(true);
    expect(isHiddenChannel({ flags: 1 << 17 })).toBe(true);
    expect(isHiddenChannel({ flags: { bitfield: 0 }, name: "___hidden___" })).toBe(true);
    expect(isHiddenChannel({ flags: { bitfield: 1 << 1 }, name: "general" })).toBe(false);
    expect(isHiddenChannel(null)).toBe(false);
  });
});

describe("deploy diff in a guild scope", () => {
  // Shapes captured from the live API: a guild command never carries
  // `contexts`, `integration_types` or `dm_permission`, whatever was sent.
  const local = commandToJSON(
    defineCommand({
      name: "scoped",
      description: "Scoped",
      contexts: ["guild"],
      integrationTypes: ["guild"],
      run: () => undefined,
    }),
  );
  const storedInGuild = {
    id: "1",
    application_id: "2",
    version: "3",
    guild_id: "4",
    default_member_permissions: null,
    type: 1,
    name: "scoped",
    name_localizations: null,
    description: "Scoped",
    description_localizations: null,
    nsfw: false,
  };

  it("ignores the global-only fields Discord drops from guild commands", () => {
    expect(commandsEqual(local, storedInGuild, { guildScope: true })).toBe(true);
  });

  it("still compares them in the global scope, where they exist", () => {
    expect(commandsEqual(local, storedInGuild)).toBe(false);
    expect(commandsEqual(local, { ...storedInGuild, contexts: [0], integration_types: [0] })).toBe(true);
  });
});

describe("init: an existing package.json", () => {
  it("switches a package with no code to ES modules and adds the scripts", async () => {
    const { adoptPackage } = await import("../src/scaffold.js");
    // What `npm init -y` writes.
    const fresh = { name: "bot", main: "index.js", type: "commonjs", scripts: { test: "echo none" } };
    const { pkg, changes, esm } = adoptPackage(fresh, false);

    expect(esm).toBe(true);
    expect(pkg.type).toBe("module");
    expect(pkg.scripts).toMatchObject({ test: "echo none", dev: "djs-bot dev", deploy: "djs-bot deploy" });
    expect(changes).toEqual(['"type": "module"', "scripts dev, start, deploy, doctor, explain, typecheck"]);
    expect(fresh.type).toBe("commonjs");
  });

  it("leaves a package with code and its own scripts alone", async () => {
    const { adoptPackage } = await import("../src/scaffold.js");
    const existing = { name: "app", main: "index.js", scripts: { dev: "nodemon", start: "node ." } };
    const { pkg, changes, esm } = adoptPackage(existing, true);

    expect(esm).toBe(false);
    expect(pkg.type).toBeUndefined();
    expect(pkg.scripts).toMatchObject({ dev: "nodemon", start: "node ." });
    expect(changes).toEqual(["scripts deploy, doctor, explain, typecheck"]);
  });

  it("changes nothing when everything is there", async () => {
    const { adoptPackage, STARTER_SCRIPTS } = await import("../src/scaffold.js");
    const done = { type: "module", scripts: { ...STARTER_SCRIPTS } };
    expect(adoptPackage(done, false)).toMatchObject({ changes: [], esm: true });
  });
});
