/**
 * Reading the arguments of a `djs-bot` command.
 *
 * @module cli-args
 */

/** Flags that take a value, which is therefore not a positional argument. */
const VALUE_FLAGS = new Set(["--guild"]);

/**
 * The first argument that is neither a flag nor the value of one: the entry
 * file, when the user gave it.
 * @example positional(["--guild", "123", "src/index.ts"]) // "src/index.ts"
 */
export function positional(args: readonly string[]): string | undefined {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (VALUE_FLAGS.has(arg)) {
      index++; // skip its value
      continue;
    }
    if (!arg.startsWith("-")) return arg;
  }
  return undefined;
}

/**
 * The value of a flag, written `--guild 123` or `--guild=123`.
 * @example flagValue(["--guild=123"], "--guild") // "123"
 */
export function flagValue(args: readonly string[], flag: string): string | undefined {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === flag) {
      const next = args[index + 1];
      return next === undefined || next.startsWith("-") ? undefined : next;
    }
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1) || undefined;
  }
  return undefined;
}
