/**
 * The `djs-bot` command-line interface.
 *
 *   djs-bot dev [entry]        Start with hot-reload + auto guild deploy
 *   djs-bot start [entry]      Start in production mode
 *   djs-bot deploy [entry]     Diff & deploy commands (adds/updates/removes automatically)
 *   djs-bot clear [entry]      Remove all commands from a scope (--global | --guild <id>)
 *   djs-bot doctor [entry]     Diagnose config, intents & permissions before running
 *   djs-bot explain [entry]    Print the capability graph (what's loaded and why)
 *   djs-bot generate <type> <name>   Scaffold a definition file
 *   djs-bot init               Scaffold a ready-to-run starter in the current directory
 *
 * @module cli
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import comfort from "@ix-xs/node-comfort";
import { version as discordJsVersion } from "discord.js";
import { loadEnvFile } from "./config.js";
import { isBot, type Bot } from "./bot.js";
import { interopDefault } from "./loader.js";
import { closeRestConnections } from "./deploy.js";
import { VERSION } from "./constants.js";
import { adoptPackage, STARTER_SCRIPTS } from "./scaffold.js";
import { parseArgs, type CliArgs } from "./cli-args.js";

// Colours that turn themselves off when the output is not a terminal, or when
// NO_COLOR asks for it.
const { bold, gray, green, red, yellow, cyan } = comfort.color;

function print(line = ""): void {
  process.stdout.write(line + "\n");
}
function ok(msg: string): void {
  print(`${green("✓")} ${msg}`);
}
function warn(msg: string): void {
  print(`${yellow("!")} ${msg}`);
}
function bad(msg: string): void {
  print(`${red("✗")} ${msg}`);
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
async function loadBot(explicit: string | undefined, command: string): Promise<Bot> {
  loadEnvFile();
  process.env.DJSBOT_CLI = "introspect";
  const entry = requireEntry(explicit, command);
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

/** Runs the entry in a child process (for dev/start), and ends with its exit code. */
async function run(entry: string, opts: { watch?: boolean; prod?: boolean }): Promise<never> {
  const nodeArgs: string[] = [];
  if (opts.watch) nodeArgs.push("--watch");
  nodeArgs.push("--enable-source-maps");
  if (hasTsx()) nodeArgs.push("--import", "tsx");
  nodeArgs.push(entry);

  const { exitCode } = await comfort.sys.run(process.execPath, nodeArgs, {
    stdio: "inherit",
    env: { NODE_ENV: opts.prod ? "production" : "development" },
    reject: false,
  });
  // No exit code: a signal killed the bot, which is not a clean stop.
  process.exit(exitCode ?? 1);
}

/* ------------------------------- commands -------------------------------- */

/** Stops with a clear message, and a failing exit code, when there is nothing to run. */
function requireEntry(entryArg: string | undefined, command: string): string {
  const entry = findEntry(entryArg);
  if (entry) return entry;
  bad(
    entryArg
      ? `Entry file "${entryArg}" does not exist.`
      : `Could not find a bot entry file. Pass one explicitly, e.g. \`djs-bot ${command} src/index.ts\`.`,
  );
  process.exit(1);
}

async function cmdDev(entryArg?: string): Promise<void> {
  const entry = requireEntry(entryArg, "dev");
  loadEnvFile();
  print(`${cyan.bold("djs-bot dev")} ${gray(`→ ${path.relative(process.cwd(), entry)} (watch)`)}`);
  await run(entry, { watch: true, prod: false });
}

async function cmdStart(entryArg?: string): Promise<void> {
  const entry = requireEntry(entryArg, "start");
  loadEnvFile();
  print(`${cyan.bold("djs-bot start")} ${gray(`→ ${path.relative(process.cwd(), entry)}`)}`);
  await run(entry, { watch: false, prod: true });
}

async function cmdDeploy(entryArg: string | undefined, { dryRun, guild: guildId }: CliArgs): Promise<void> {
  const bot = await loadBot(entryArg, "deploy");
  const result = await bot.deploy({ dryRun, guildId });
  print();
  for (const target of result.targets) {
    const label = target.scope === "global" ? "global" : `guild ${target.guildId}`;
    ok(`${label}${dryRun ? " (dry run)" : ""}`);
    if (target.added.length) print(`  ${green(`+ ${target.added.join(", ")}`)}`);
    if (target.changed.length) print(`  ${yellow(`~ ${target.changed.join(", ")}`)}`);
    if (target.removed.length) print(`  ${red(`- ${target.removed.join(", ")}`)}`);
    if (!target.added.length && !target.changed.length && !target.removed.length) {
      print(`  ${gray("no changes")}`);
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
      print(`  ${gray(`djs-bot clear --guild ${bot.devGuildId}`)}`);
    }
  }

  await closeRestConnections(); // close undici before exit so Windows doesn't assert
  process.exit(0);
}

async function cmdClear(entryArg: string | undefined, { dryRun, global, guild: guildId }: CliArgs): Promise<void> {
  const bot = await loadBot(entryArg, "clear");
  if (!global && !guildId) {
    bad("Specify what to clear: `--global` or `--guild <id>`.");
    process.exit(1);
  }
  const target = await bot.clear({ guildId: global ? undefined : guildId, dryRun });
  const label = target.scope === "global" ? "global" : `guild ${target.guildId}`;
  print();
  if (target.removed.length) {
    ok(`Cleared ${target.removed.length} command(s) from ${label}${dryRun ? " (dry run)" : ""}`);
    print(`  ${red(`- ${target.removed.join(", ")}`)}`);
  } else {
    ok(`Nothing to clear in ${label}`);
  }
  await closeRestConnections(); // close undici before exit so Windows doesn't assert
  process.exit(0);
}

async function cmdExplain(entryArg: string | undefined, json: boolean): Promise<void> {
  const bot = await loadBot(entryArg, "explain");
  const d = await bot.describe();
  if (json) {
    // Machine-readable, for scripts and CI checks.
    print(JSON.stringify(d, null, 2));
    process.exit(0);
  }
  const section = (title: string, items: string[]) => {
    print(`${bold(title)} ${gray(`(${items.length})`)}`);
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

  print(bold("Deployment plan"));
  print(`  ${gray("global:")} ${d.deployment.global.join(", ") || gray("(none)")}`);
  for (const [guildId, names] of Object.entries(d.deployment.guilds)) {
    print(`  ${gray(`guild ${guildId}:`)} ${names.join(", ")}`);
  }
  process.exit(0);
}

/** Compares dotted versions: is `actual` at least `minimum`? */
function atLeast(actual: string, minimum: string): boolean {
  const a = actual.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const m = minimum.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < m.length; i++) {
    if ((a[i] ?? 0) !== (m[i] ?? 0)) return (a[i] ?? 0) > (m[i] ?? 0);
  }
  return true;
}

const MIN_NODE = "22.13.0";
const MIN_DISCORD_JS = "14.27.0";

async function cmdDoctor(entryArg?: string): Promise<void> {
  print(`${bold("djs-bot doctor")} ${gray(`v${VERSION}`)}\n`);
  let failed = false;
  const fail = (msg: string): void => {
    failed = true;
    bad(msg);
  };

  if (atLeast(process.versions.node, MIN_NODE)) ok(`Node ${process.versions.node}`);
  else fail(`Node ${process.versions.node} - djs-bot needs >= ${MIN_NODE}`);

  if (atLeast(discordJsVersion, MIN_DISCORD_JS)) ok(`discord.js ${discordJsVersion}`);
  else fail(`discord.js ${discordJsVersion} - djs-bot needs >= ${MIN_DISCORD_JS} (npm i discord.js@latest)`);

  loadEnvFile();
  const token = process.env.DISCORD_TOKEN;
  if (!token) fail("DISCORD_TOKEN is missing (env or .env)");
  // A bot token is three base64url parts. Checking the shape catches the usual
  // mix-up with the client secret or the public key, without ever printing it.
  else if (token.split(".").length !== 3) fail("DISCORD_TOKEN does not look like a bot token (did you copy the client secret?)");
  else ok("DISCORD_TOKEN is set");

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) warn("DISCORD_CLIENT_ID is missing - needed to deploy commands");
  else if (!/^\d{17,20}$/.test(clientId)) fail("DISCORD_CLIENT_ID is not a valid id (expected 17-20 digits)");
  else ok("DISCORD_CLIENT_ID is set");

  const devGuild = process.env.DISCORD_DEV_GUILD;
  if (!devGuild) warn("DISCORD_DEV_GUILD is not set - commands will take up to an hour to appear while you develop");
  else if (!/^\d{17,20}$/.test(devGuild)) fail("DISCORD_DEV_GUILD is not a valid id (expected 17-20 digits)");
  else ok("DISCORD_DEV_GUILD is set");

  if (comfort.fs.exists(path.resolve(".env")) && comfort.fs.exists(path.resolve(".git"))) {
    const ignored = (comfort.fs.readLines(".gitignore") ?? []).some((line) => /^\/?\.env(\b|$)/.test(line.trim()));
    if (ignored) ok(".env is git-ignored");
    else fail(".env is NOT in .gitignore - your token would be committed");
  }

  try {
    const bot = await loadBot(entryArg, "doctor");
    const d = await bot.describe();
    const components = d.buttons.length + d.selectMenus.length + d.modals.length;
    ok(
      `Loaded ${d.commands.length + d.userCommands.length + d.messageCommands.length} command(s), ` +
        `${components} component(s), ${d.events.length} event(s), ${d.jobs.length} job(s), ${d.services.length} service(s)`,
    );
    if (d.privilegedIntents.length) {
      warn(`Enable these privileged intents in the Developer Portal: ${d.privilegedIntents.join(", ")}`);
    } else {
      ok("No privileged intents required");
    }
    if (d.commands.length + d.userCommands.length + d.messageCommands.length === 0) {
      warn("No commands registered - did you point `features` at the right folder?");
    }
  } catch (error) {
    print();
    bad(`Failed to load bot: ${error instanceof Error ? error.toString() : String(error)}`);
    process.exit(1);
  }

  print();
  if (failed) {
    bad("Doctor found problems");
    process.exit(1);
  }
  ok("Doctor finished - everything looks good");
  process.exit(0);
}

async function cmdGenerate(args: readonly string[]): Promise<void> {
  const [type, name] = args;
  if (!type || !name) {
    bad(
      `Usage: djs-bot generate <${Object.keys(TEMPLATES).join("|")}> <name>`,
    );
    process.exit(1);
  }
  const featuresDir = comfort.fs.exists(path.resolve("src/features")) ? "src/features" : "features";
  const kebab = comfort.str.kebabCase(name);
  const pascal = comfort.str.pascalCase(name);
  const dir = path.resolve(featuresDir, kebab);
  const file = TEMPLATES[type as keyof typeof TEMPLATES];
  if (!file) {
    bad(`Unknown generator "${type}". Available: ${Object.keys(TEMPLATES).join(", ")}.`);
    process.exit(1);
  }
  const { filename, content } = file(kebab, pascal);
  const target = path.resolve(dir, filename);
  if (comfort.fs.exists(target)) {
    bad(`${path.relative(process.cwd(), target)} already exists.`);
    process.exit(1);
  }
  if (!comfort.fs.createFile(target, true, content)) {
    bad(`Could not write ${path.relative(process.cwd(), target)}.`);
    process.exit(1);
  }
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
    if (comfort.fs.createFile(target, true, content)) ok(`Created ${rel}`);
    else bad(`Could not write ${rel}`);
  };
  write("src/index.ts", STARTER.entry);
  write("src/features/ping/ping.command.ts", STARTER.ping);
  write("src/types.d.ts", STARTER.types);
  write("tsconfig.json", STARTER.tsconfig);
  write(".env", STARTER.env);
  write(".env.example", STARTER.env);
  write(".gitignore", STARTER.gitignore);
  adoptOrWritePackage(write);
  print();
  ok("Starter created. Next:");
  print(`  ${gray("1.")} put your token, client id and test server id in .env`);
  print(`  ${gray("2.")} npm i @ix-xs/djs-bot discord.js && npm i -D tsx typescript @types/node`);
  print(`  ${gray("3.")} npx djs-bot doctor`);
  print(`  ${gray("4.")} npx djs-bot dev`);
  process.exit(0);
}

/**
 * Creates the starter's `package.json`, or completes the one that is already
 * there (most people run `npm init` first): its scripts are added, and it is
 * switched to ES modules when it has no code yet.
 */
function adoptOrWritePackage(write: (rel: string, content: string) => void): void {
  const target = path.resolve("package.json");
  if (!comfort.fs.exists(target)) {
    write("package.json", STARTER.packageJson(path.basename(process.cwd())));
    return;
  }
  const existing = comfort.fs.readJSON<unknown>(target);
  if (typeof existing !== "object" || existing === null || Array.isArray(existing)) {
    warn("package.json exists but is not a valid package file - skipped");
    return;
  }
  const manifest = existing as Record<string, unknown>;
  const main = typeof manifest.main === "string" ? manifest.main : "index.js";
  const { pkg, changes, esm } = adoptPackage(manifest, comfort.fs.exists(path.resolve(main)));
  if (changes.length > 0) {
    if (comfort.fs.writeJSON(target, pkg)) ok(`Updated package.json (${changes.join("; ")})`);
    else bad("Could not write package.json");
  } else {
    ok("package.json already has what the starter needs");
  }
  if (!esm) {
    warn('package.json is a CommonJS package with existing code: the starter uses ES modules.');
    print(`  ${gray("↳ once your code is ready for it: npm pkg set type=module")}`);
  }
}

function help(): void {
  print(`${bold("djs-bot")} - a TypeScript-first Discord bot framework

${bold("Usage")}
  djs-bot <command> [options]

${bold("Commands")}
  ${cyan("dev")} [entry]              Start with watch + instant guild deploy
  ${cyan("start")} [entry]            Start in production mode
  ${cyan("deploy")} [entry]           Diff & deploy commands  ${gray("(--dry-run, --guild <id>)")}
  ${cyan("clear")} [entry]            Remove all commands  ${gray("(--global | --guild <id>)")}
  ${cyan("doctor")} [entry]           Diagnose config, intents & permissions
  ${cyan("explain")} [entry]          Print what's loaded and why  ${gray("(--json)")}
  ${cyan("generate")} <type> <name>   Scaffold a definition file
  ${cyan("init")}                     Scaffold a minimal starter
  ${cyan("help")}, ${cyan("version")}            Show help / version`);
}

/* -------------------------------- helpers -------------------------------- */

async function main(): Promise<void> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    // A command or an option that does not exist: nothing runs.
    bad(error instanceof Error ? error.message : String(error));
    print(`  ${gray("↳ djs-bot help lists the commands and their options")}`);
    process.exit(1);
  }
  if (args.version || args.command === "version") {
    print(`djs-bot ${VERSION}  (discord.js ${discordJsVersion}, node ${process.versions.node})`);
    return;
  }
  // Asking for help never runs the command it is asked about.
  if (args.help || args.command === undefined || args.command === "help") return help();

  const entry = args.positionals[0];
  switch (args.command) {
    case "dev":
      return cmdDev(entry);
    case "start":
      return cmdStart(entry);
    case "deploy":
      return cmdDeploy(entry, args);
    case "clear":
      return cmdClear(entry, args);
    case "explain":
      return cmdExplain(entry, args.json);
    case "doctor":
      return cmdDoctor(entry);
    case "generate":
    case "g":
      return cmdGenerate(args.positionals);
    case "init":
      return cmdInit();
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
    // also available: field.select, field.users, field.roles, field.channels,
    // field.files, field.radio, field.checkboxes, field.checkbox, field.text
  },
  run: async (ctx) => {
    await ctx.reply.success(\`Received: \${ctx.fields.body}\`);
  },
});

// Open it from a command or a button: await ctx.showModal(${pascal}Modal);
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
  plugin: (kebab: string, pascal: string) => ({
    filename: `${kebab}.plugin.ts`,
    content: `import { definePlugin } from "@ix-xs/djs-bot";

export const ${pascal}Plugin = definePlugin({
  name: "${kebab}",
  setup(app) {
    app.hooks.beforeInteraction(async (ctx, next) => {
      // runs before every interaction; skip next() to stop it here
      await next();
    });
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
  clientId: env.optional("DISCORD_CLIENT_ID"),
  features: \`\${import.meta.dirname}/features\`,
  intents: "auto",
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
  // Acknowledge slow handlers automatically, so they never hit the 3 s limit.
  defaults: { defer: true },
});

export default bot;

// Start only when run directly (the CLI imports this file for tooling).
if (!process.env.DJSBOT_CLI) void bot.start();
`,
  ping: `import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply.success(\`Pong! 🏓 \${Math.round(ctx.client.ws.ping)} ms\`),
});
`,
  types: `// Declare your services here once, and ctx.services is typed everywhere.
// (store, audit and flags are already typed by the framework.)
declare module "@ix-xs/djs-bot" {
  interface ServiceMap {
    // db: import("./db.js").Database;
  }
}

export {};
`,
  tsconfig: `{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
`,
  env: `# Bot token: Developer Portal > your app > Bot > Reset Token
DISCORD_TOKEN=
# Application id: Developer Portal > your app > General Information
DISCORD_CLIENT_ID=
# Your test server id (right-click the server > Copy Server ID).
# Commands appear there instantly while you develop.
DISCORD_DEV_GUILD=
`,
  gitignore: `node_modules/
dist/
data/
.env
.djs-bot/
`,
  packageJson: (name: string) => `{
  "name": "${comfort.str.kebabCase(name) || "my-bot"}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=${MIN_NODE}" },
  "scripts": ${JSON.stringify(STARTER_SCRIPTS, null, 2).replace(/\n/g, "\n  ")}
}
`,
};

// Kick off the CLI last, so const templates above are initialised first.
/**
 * Turns the Discord API errors people actually hit from the CLI into a next
 * step. Returns `undefined` for anything it does not recognise.
 */
function restHint(error: unknown): string | undefined {
  const { status, code } = (error ?? {}) as { status?: number; code?: number | string };
  if (status === 401) {
    return "Discord rejected the token. Copy it again from the Developer Portal (Bot > Reset Token) into DISCORD_TOKEN.";
  }
  if (code === 50001 || status === 403) {
    return "Missing access: the bot is not in that server, or it was invited without the applications.commands scope.";
  }
  if (code === 10002) return "Unknown application: DISCORD_CLIENT_ID does not match the token's application.";
  if (code === 30034) return "Daily limit reached: Discord allows 200 command creations per day and per server. Try again tomorrow.";
  if (status === 429) return "Rate limited by Discord. Wait a moment, then run the command again.";
  return undefined;
}

main().catch(async (error) => {
  // A BotError prints its code, its hint and a docs link; show all of it.
  bad(error instanceof Error ? error.toString() : String(error));
  const hint = restHint(error);
  if (hint) print(`  ${gray(`↳ ${hint}`)}`);
  // A failed deploy has open connections too: let them close before exiting.
  await closeRestConnections();
  process.exit(1);
});
