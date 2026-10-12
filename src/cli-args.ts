/**
 * Reading the arguments of a `djs-bot` command line.
 *
 * @module cli-args
 */
import comfort from "@ix-xs/node-comfort";

const FLAGS = {
  guild: { type: "string" },
  "dry-run": { type: "boolean" },
  global: { type: "boolean" },
  json: { type: "boolean" },
  // Declared here so that they come back as flags: the CLI prints its own help
  // and its own version line.
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const;

type Option = Exclude<keyof typeof FLAGS, "help" | "version">;
const OPTIONS: readonly Option[] = ["guild", "dry-run", "global", "json"];

/** Every command, with the options it takes. */
const COMMANDS = {
  dev: [],
  start: [],
  deploy: ["dry-run", "guild"],
  clear: ["dry-run", "global", "guild"],
  doctor: [],
  explain: ["json"],
  generate: [],
  g: [],
  init: [],
  help: [],
  version: [],
} as const satisfies Record<string, readonly Option[]>;

/** A command of `djs-bot`. */
export type CliCommand = keyof typeof COMMANDS;

/** A parsed `djs-bot` command line. */
export interface CliArgs {
  /** The command, when one was given. */
  command?: CliCommand;
  /** What follows the command and is not an option: the entry file, or what to generate. */
  positionals: string[];
  /** `--guild <id>` or `--guild=<id>`. */
  guild?: string;
  /** `--dry-run`. */
  dryRun: boolean;
  /** `--global`. */
  global: boolean;
  /** `--json`. */
  json: boolean;
  /** `--help` or `-h`. */
  help: boolean;
  /** `--version` or `-v`. */
  version: boolean;
}

/**
 * Parses what follows `djs-bot` on the command line.
 *
 * It refuses what it does not understand instead of guessing: a command or an
 * option that does not exist, an option the command does not take, and
 * `--guild` without an id (which would otherwise deploy everywhere).
 *
 * @example parseArgs(["deploy", "--guild", "123", "src/index.ts"])
 * // { command: "deploy", positionals: ["src/index.ts"], guild: "123", dryRun: false, ... }
 * @throws {TypeError} With a message that is ready to show.
 */
export function parseArgs(argv: readonly string[]): CliArgs {
  const { command, positionals, flags } = comfort.cli.args(FLAGS, {
    argv: [...argv],
    name: "djs-bot",
    commands: Object.fromEntries(Object.keys(COMMANDS).map((name) => [name, ""])),
    help: false,
  });
  if (flags.guild === "") throw new TypeError("Option --guild needs a value");

  const name = command as CliCommand | undefined;
  if (name && !flags.help && !flags.version) {
    const taken: readonly Option[] = COMMANDS[name];
    for (const option of OPTIONS) {
      const given = option === "guild" ? flags.guild !== undefined : flags[option];
      if (given && !taken.includes(option)) throw new TypeError(`Option --${option} does not apply to "djs-bot ${name}"`);
    }
  }

  return {
    command: name,
    positionals,
    guild: flags.guild,
    dryRun: flags["dry-run"],
    global: flags.global,
    json: flags.json,
    help: flags.help,
    version: flags.version,
  };
}
