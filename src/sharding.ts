/**
 * Sharding.
 *
 * When `sharding` is enabled, the process you launch becomes a **manager** that
 * spawns one child process per shard (re-running your entry file); each child
 * runs the bot normally. discord.js auto-detects the shard assignment from the
 * environment the manager sets, so your code is identical sharded or not.
 *
 * @module sharding
 */
import { ShardingManager } from "discord.js";
import type { Logger } from "./logger.js";

/** Sharding configuration. */
export interface ShardingOptions {
  /** Number of shards, or `"auto"` to let Discord decide. Default `"auto"`. */
  totalShards?: number | "auto";
  /** `"process"` (default) forks child processes; `"worker"` uses worker threads. */
  mode?: "process" | "worker";
  /** Restart a shard if it dies. Default `true`. */
  respawn?: boolean;
}

/** Normalises the loose `sharding` config into full options. */
export function normalizeSharding(input: boolean | "auto" | ShardingOptions): ShardingOptions {
  if (typeof input !== "object") return { totalShards: "auto", mode: "process", respawn: true };
  return { totalShards: input.totalShards ?? "auto", mode: input.mode ?? "process", respawn: input.respawn ?? true };
}

/**
 * True when the current process is a shard child spawned by a manager (so it
 * should run the bot), rather than the manager itself.
 */
export function isShardChild(): boolean {
  return process.env.SHARDING_MANAGER === "true";
}

/**
 * Launches a {@link ShardingManager} for the given entry file. Called from the
 * manager process only; resolves once all shards have been spawned.
 */
export async function launchShardManager(
  entryFile: string,
  token: string,
  options: ShardingOptions,
  logger: Logger,
): Promise<ShardingManager> {
  const manager = new ShardingManager(entryFile, {
    token,
    totalShards: options.totalShards ?? "auto",
    mode: options.mode ?? "process",
    respawn: options.respawn ?? true,
    // Propagate runtime flags (e.g. `--import tsx`) so children boot the same way.
    execArgv: process.execArgv,
  });

  manager.on("shardCreate", (shard) => {
    logger.info({ shard: shard.id }, "Spawned shard");
    shard.on("death", () => logger.warn({ shard: shard.id }, "Shard died"));
    shard.on("ready", () => logger.debug({ shard: shard.id }, "Shard ready"));
  });

  await manager.spawn();
  logger.info({ total: manager.totalShards }, "All shards spawned");
  return manager;
}
