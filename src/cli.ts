/**
 * The `djs-bot` command-line interface.
 *
 *   djs-bot dev [entry]        Start with hot-reload + auto guild deploy
 *   djs-bot start [entry]      Start in production mode
 *   djs-bot deploy [entry]     Diff & deploy commands (adds/updates/removes automatically)
 *   djs-bot clear [entry]      Remove all commands from a scope (--global | --guild <id>)
 *   djs-bot doctor [entry]     Diagnose config, intents & permissions before running
 *   djs-bot explain [entry]    Print the capability graph (what's loaded and why)
 *   djs-bot generate <type> <name>   Scaffold a command/event/button/modal/service/job/feature
 *   djs-bot init               Scaffold a minimal starter in the current directory
 *
 * @module cli
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import comfort from "@ix-xs/node-comfort";
import { loadEnvFile } from "./config.js";
import { isBot, type Bot } from "./bot.js";
import { interopDefault } from "./loader.js";
import { closeRestConnections } from "./deploy.js";
import { VERSION } from "./constants.js";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function print(line = ""): void {
  process.stdout.write(line + "\n");
}
function ok(msg: string): void {
  print(`${C.green}✓${C.reset} ${msg}`);
}
function warn(msg: string): void {
  print(`${C.yellow}!${C.reset} ${msg}`);
}
function bad(msg: string): void {
  print(`${C.red}✗${C.reset} ${msg}`);
}

const ENTRY_CANDIDATES = [
  "src/index.ts",
  "src/bot.ts",
  "src/main.ts",
  "bot.ts",
  "index.ts",
  "dist/index.js",
  "dist/bot.js",
  "src/index.js",
  "index.js",
];

function findEntry(explicit?: string): string | undefined {
  const candidates = explicit ? [explicit] : ENTRY_CANDIDATES;
  for (const candidate of candidates) {
    const abs = path.resolve(candidate);
    if (comfort.fs.exists(abs)) return abs;
  }
  return undefined;
}

function hasTsx(): boolean {
  try {
    createRequire(path.resolve("noop.js")).resolve("tsx");
    return true;
  } catch {
    return false;
  }
}

/**
 * Registers the tsx ESM loader so raw `.ts` entries (with `.js` import
 * specifiers) can be imported in-process for introspection. No-op for compiled
 * `.js` entries or when tsx is not installed.
 */
async function ensureTsLoader(entry: string): Promise<void> {
  if (!/\.[mc]?ts$/.test(entry) || !hasTsx()) return;
  try {
    const api = (await import("tsx/esm/api")) as { register: () => void };
    api.register();
  } catch {
    /* fall back to Node's native type stripping */
  }
}

/** Imports the entry in-process (introspection only - never connects). */
async function loadBot(explicit?: string): Promise<Bot> {
  loadEnvFile();
  process.env.DJSBOT_CLI = "introspect";
  const entry = findEntry(explicit);
  if (!entry) {
    bad("Could not find a bot entry file. Pass one explicitly, e.g. `djs-bot explain src/index.ts`.");
    process.exit(1);
  }
  await ensureTsLoader(entry);
  const mod = (await import(pathToFileURL(entry).href)) as Record<string, unknown>;
  const bot = interopDefault(mod);
  if (!isBot(bot)) {
    bad(`Entry "${path.relative(process.cwd(), entry)}" must default-export a bot from defineBot().`);
    process.exit(1);
  }
  await bot.load();
  return bot as Bot;
}

/** Spawns the entry in a child process (for dev/start). */
function run(entry: string, opts: { watch?: boolean; prod?: boolean }): void {
  const nodeArgs: string[] = [];
  if (opts.watch) nodeArgs.push("--watch");
  nodeArgs.push("--enable-source-maps");
  if (hasTsx()) nodeArgs.push("--import", "tsx");
  nodeArgs.push(entry);

  const child = spawn(process.execPath, nodeArgs, {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: opts.prod ? "production" : "development" },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

/* ------------------------------- commands -------------------------------- */

async function cmdDev(entryArg?: string): Promise<void> {
  const entry = findEntry(entryArg);
  if (!entry) return void bad("No entry file found.");
  loadEnvFile();
  print(`${C.cyan}${C.bold}djs-bot dev${C.reset} ${C.gray}→ ${path.relative(process.cwd(), entry)} (watch)${C.reset}`);
  run(entry, { watch: true, prod: false });
}

async function cmdStart(entryArg?: string): Promise<void> {
  const entry = findEntry(entryArg);
  if (!entry) return void bad("No entry file found.");
  loadEnvFile();
  print(`${C.cyan}${C.bold}djs-bot start${C.reset} ${C.gray}→ ${path.relative(process.cwd(), entry)}${C.reset}`);
  run(entry, { watch: false, prod: true });
}

async function cmdDeploy(args: string[]): Promise<void> {
  const bot = await loadBot(positional(args));
  const dryRun = args.includes("--dry-run");
  const guildId = flagValue(args, "--guild");
  const result = await bot.deploy({ dryRun, guildId });
  print();
  for (const target of result.targets) {
    const label = target.scope === "global" ? "global" : `guild ${target.guildId}`;
    ok(`${label}${dryRun ? " (dry run)" : ""}`);
    if (target.added.length) print(`  ${C.green}+ ${target.added.join(", ")}${C.reset}`);
    if (target.changed.length) print(`  ${C.yellow}~ ${target.changed.join(", ")}${C.reset}`);
    if (target.removed.length) print(`  ${C.red}- ${target.removed.join(", ")}${C.reset}`);
    if (!target.added.length && !target.changed.length && !target.removed.length) {
      print(`  ${C.gray}no changes${C.reset}`);
    }
  }

  // Duplicate-command footgun: `djs-bot dev` mirrors every command to the dev
  // guild as GUILD commands. Deploying the same commands GLOBALLY makes both
  // appear side by side in that guild. Warn and show how to clear the mirror.
  if (!guildId && bot.devGuildId) {
    const globalTarget = result.targets.find((t) => t.scope === "global");
    const hasGlobal = globalTarget && globalTarget.added.length + globalTarget.changed.length + globalTarget.unchanged.length > 0;
    if (hasGlobal) {
      print();
      warn(
        `Your dev guild (${bot.devGuildId}) still holds the command mirror from \`djs-bot dev\`. ` +
          `These global commands will appear as DUPLICATES there until you clear it:`,
      );
      print(`  ${C.gray}djs-bot clear --guild ${bot.devGuildId}${C.reset}`);
    }
  }

  await closeRestConnections(); // close undici before exit so Windows doesn't assert
  process.exit(0);
}

async function cmdClear(args: string[]): Promise<void> {
  const bot = await loadBot(positional(args));
  const dryRun = args.includes("--dry-run");
  const global = args.includes("--global");
  const guildId = flagValue(args, "--guild");
  if (!global && !guildId) {
    bad("Specify what to clear: `--global` or `--guild <id>`.");
    process.exit(1);
  }
  const target = await bot.clear({ guildId: global ? undefined : guildId, dryRun });
  const label = target.scope === "global" ? "global" : `guild ${target.guildId}`;
  print();
  if (target.removed.length) {
    ok(`Cleared ${target.removed.length} command(s) from ${label}${dryRun ? " (dry run)" : ""}`);
    print(`  ${C.red}- ${target.removed.join(", ")}${C.reset}`);
  } else {
    ok(`Nothing to clear in ${label}`);
  }
  await closeRestConnections(); // close undici before exit so Windows doesn't assert
  process.exit(0);
}

async function cmdExplain(entryArg?: string): Promise<void> {
  const bot = await loadBot(entryArg);
  const d = await bot.describe();
  const section = (title: string, items: string[]) => {
    print(`${C.bold}${title}${C.reset} ${C.gray}(${items.length})${C.reset}`);
    if (items.length) print(`  ${items.join(", ")}`);
  };
  print();
  section("Intents", d.intents);
  if (d.privilegedIntents.length) warn(`Privileged intents in use: ${d.privilegedIntents.join(", ")}`);
  section("Partials", d.partials);
  section("Commands", d.commands);
  section("User commands", d.userCommands);
  section("Message commands", d.messageCommands);
  section("Buttons", d.buttons);
  section("Select menus", d.selectMenus);
  section("Modals", d.modals);
  section("Events", d.events);
  section("Triggers", d.triggers);
  section("Jobs", d.jobs);
  section("Services", d.services);
  section("Plugins", d.plugins);
  section("Features", d.features);

  print(`${C.bold}Deployment plan${C.reset}`);
  print(`  ${C.gray}global:${C.reset} ${d.deployment.global.join(", ") || C.gray + "(none)" + C.reset}`);
  for (const [guildId, names] of Object.entries(d.deployment.guilds)) {
    print(`  ${C.gray}guild ${guildId}:${C.reset} ${names.join(", ")}`);
  }
  process.exit(0);
}

async function cmdDoctor(entryArg?: string): Promise<void> {
  print(`${C.bold}djs-bot doctor${C.reset}\n`);
  const [major] = process.versions.node.split(".").map(Number);
  if ((major ?? 0) >= 22) ok(`Node ${process.versions.node}`);
  else bad(`Node ${process.versions.node} - djs-bot needs >= 22`);

  loadEnvFile();
  if (process.env.DISCORD_TOKEN) ok("DISCORD_TOKEN is set");
  else bad("DISCORD_TOKEN is missing (env or .env)");
  if (process.env.DISCORD_CLIENT_ID) ok("DISCORD_CLIENT_ID is set");
  else warn("DISCORD_CLIENT_ID is missing - needed to deploy commands");

  try {
    const bot = await loadBot(entryArg);
    const d = await bot.describe();
    ok(`Loaded ${d.commands.length} command(s), ${d.events.length} event(s), ${d.features.length} feature(s)`);
    if (d.privilegedIntents.length) {
      warn(`Enable these privileged intents in the Developer Portal: ${d.privilegedIntents.join(", ")}`);
    } else {
      ok("No privileged intents required");
    }
    if (d.commands.length === 0) warn("No commands registered - did you point `features` at the right folder?");
    print();
    ok("Doctor finished");
  } catch (error) {
    print();
    bad(`Failed to load bot: ${(error as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
}

async function cmdGenerate(args: string[]): Promise<void> {
  const [type, name] = args;
  if (!type || !name) {
    bad("Usage: djs-bot generate <command|event|button|modal|select|service|job|feature> <name>");
    process.exit(1);
  }
  const featuresDir = comfort.fs.exists(path.resolve("src/features")) ? "src/features" : "features";
  const kebab = comfort.str.kebabCase(name);
  const pascal = comfort.str.pascalCase(name);
  const dir = path.resolve(featuresDir, kebab);
  const file = TEMPLATES[type as keyof typeof TEMPLATES];
  if (!file) {
    bad(`Unknown generator "${type}".`);
    process.exit(1);
  }
  const { filename, content } = file(kebab, pascal);
  const target = path.resolve(dir, filename);
  if (comfort.fs.exists(target)) {
    bad(`${path.relative(process.cwd(), target)} already exists.`);
    process.exit(1);
  }
  comfort.fs.createFile(target, true, content);
  ok(`Created ${path.relative(process.cwd(), target)}`);
  process.exit(0);
}

async function cmdInit(): Promise<void> {
  const write = (rel: string, content: string) => {
    const target = path.resolve(rel);
    if (comfort.fs.exists(target)) {
      warn(`${rel} exists - skipped`);
      return;
    }
    comfort.fs.createFile(target, true, content);
    ok(`Created ${rel}`);
  };
  write("src/index.ts", STARTER.entry);
  write("src/features/ping/ping.command.ts", STARTER.ping);
  write(".env", STARTER.env);
  print();
  ok("Starter created. Next:");
  print(`  ${C.gray}1.${C.reset} put your token in .env`);
  print(`  ${C.gray}2.${C.reset} npm i @ix-xs/djs-bot discord.js`);
  print(`  ${C.gray}3.${C.reset} npx djs-bot dev`);
  process.exit(0);
}

function help(): void {
  print(`${C.bold}djs-bot${C.reset} - a TypeScript-first Discord bot framework

${C.bold}Usage${C.reset}
  djs-bot <command> [options]

${C.bold}Commands${C.reset}
  ${C.cyan}dev${C.reset} [entry]              Start with watch + instant guild deploy
  ${C.cyan}start${C.reset} [entry]            Start in production mode
  ${C.cyan}deploy${C.reset} [entry]           Diff & deploy commands  ${C.gray}(--dry-run, --guild <id>)${C.reset}
  ${C.cyan}clear${C.reset} [entry]            Remove all commands  ${C.gray}(--global | --guild <id>)${C.reset}
  ${C.cyan}doctor${C.reset} [entry]           Diagnose config, intents & permissions
  ${C.cyan}explain${C.reset} [entry]          Print what's loaded and why
  ${C.cyan}generate${C.reset} <type> <name>   Scaffold a definition file
  ${C.cyan}init${C.reset}                     Scaffold a minimal starter
  ${C.cyan}help${C.reset}, ${C.cyan}version${C.reset}            Show help / version`);
}

/* -------------------------------- helpers -------------------------------- */

function positional(args: string[]): string | undefined {
  return args.find((a) => !a.startsWith("--"));
}
function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "dev":
      return cmdDev(positional(rest));
    case "start":
      return cmdStart(positional(rest));
    case "deploy":
      return cmdDeploy(rest);
    case "clear":
      return cmdClear(rest);
    case "explain":
      return cmdExplain(positional(rest));
    case "doctor":
      return cmdDoctor(positional(rest));
    case "generate":
    case "g":
      return cmdGenerate(rest);
    case "init":
      return cmdInit();
    case "version":
    case "--version":
    case "-v":
      print(VERSION);
      return;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return help();
    default:
      bad(`Unknown command "${command}".`);
      help();
      process.exit(1);
  }
}

/* ------------------------------ templates -------------------------------- */

const TEMPLATES = {
  command: (kebab: string, pascal: string) => ({
    filename: `${kebab}.command.ts`,
    content: `import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "${kebab}",
  description: "Describe ${pascal} here",
  options: {
    // example: text: s.string({ description: "Some text", required: true }),
  },
  run: async (ctx) => {
    await ctx.reply.success("${pascal} works!");
  },
});
`,
  }),
  event: (kebab: string) => ({
    filename: `${kebab}.event.ts`,
    content: `import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("guildMemberAdd", async (member, ctx) => {
  ctx.logger.info({ id: member.id }, "member joined");
});
`,
  }),
  trigger: (kebab: string) => ({
    filename: `${kebab}.trigger.ts`,
    content: `import { defineTrigger } from "@ix-xs/djs-bot";

export default defineTrigger({
  name: "${kebab}",
  pattern: "${kebab}",     // keyword, RegExp, or (message) => boolean
  run: async (ctx) => {
    await ctx.reply("Triggered!");
  },
});
`,
  }),
  button: (kebab: string, pascal: string) => ({
    filename: `${kebab}.button.ts`,
    content: `import { defineButton, p, ButtonStyle } from "@ix-xs/djs-bot";

export const ${pascal}Button = defineButton({
  id: "${kebab}",
  params: { id: p.string },
  label: "${pascal}",
  style: ButtonStyle.Primary,
  run: async (ctx) => {
    await ctx.reply.success(\`Clicked with id \${ctx.params.id}\`);
  },
});
`,
  }),
  modal: (kebab: string, pascal: string) => ({
    filename: `${kebab}.modal.ts`,
    content: `import { defineModal, field } from "@ix-xs/djs-bot";

export const ${pascal}Modal = defineModal({
  id: "${kebab}",
  title: "${pascal}",
  fields: {
    body: field.paragraph({ label: "Your message", required: true }),
  },
  run: async (ctx) => {
    await ctx.reply.success(\`Received: \${ctx.fields.body}\`);
  },
});
`,
  }),
  select: (kebab: string, pascal: string) => ({
    filename: `${kebab}.select.ts`,
    content: `import { defineSelectMenu } from "@ix-xs/djs-bot";

export const ${pascal}Select = defineSelectMenu({
  id: "${kebab}",
  run: async (ctx) => {
    await ctx.reply.success(\`You picked: \${ctx.values.join(", ")}\`);
  },
});
`,
  }),
  service: (kebab: string, pascal: string) => ({
    filename: `${kebab}.service.ts`,
    content: `import { defineService } from "@ix-xs/djs-bot";

export const ${pascal}Service = defineService("${kebab}", {
  deps: [],
  factory: () => ({
    hello: () => "world",
  }),
});
`,
  }),
  job: (kebab: string, pascal: string) => ({
    filename: `${kebab}.job.ts`,
    content: `import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "${kebab}",
  schedule: "1h",
  run: async (ctx) => {
    ctx.logger.info({}, "${pascal} job ran");
  },
});
`,
  }),
  feature: (kebab: string, pascal: string) => ({
    filename: `${kebab}.feature.ts`,
    content: `import { defineFeature } from "@ix-xs/djs-bot";

export default defineFeature({
  name: "${kebab}",
  // commands: [], events: [], services: [], requires: [],
});
`,
  }),
  user: (kebab: string, pascal: string) => ({
    filename: `${kebab}.user.ts`,
    content: `import { defineUserCommand } from "@ix-xs/djs-bot";

export default defineUserCommand({
  name: "${pascal}",
  run: async (ctx) => {
    await ctx.reply.info(\`Target: \${ctx.targetUser.tag}\`, { ephemeral: true });
  },
});
`,
  }),
  message: (kebab: string, pascal: string) => ({
    filename: `${kebab}.message.ts`,
    content: `import { defineMessageCommand } from "@ix-xs/djs-bot";

export default defineMessageCommand({
  name: "${pascal}",
  run: async (ctx) => {
    await ctx.reply.info(\`Message length: \${ctx.targetMessage.content.length}\`, { ephemeral: true });
  },
});
`,
  }),
} as const;

const STARTER = {
  entry: `import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: "./src/features",
  intents: "auto",
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
});

export default bot;

// Start only when run directly (the CLI imports this file for tooling).
if (!process.env.DJSBOT_CLI) void bot.start();
`,
  ping: `import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply.success("Pong! 🏓"),
});
`,
  env: `DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_DEV_GUILD=
NODE_ENV=development
`,
};

// Kick off the CLI last, so const templates above are initialised first.
main().catch((error) => {
  bad((error as Error).message);
  process.exit(1);
});
