/**
 * Audit trail - a structured, queryable record of who did what.
 *
 * Write audit entries to one or more **sinks** (in-memory, a {@link KVStore}, or
 * the logger). When configured on the bot, `ctx.audit(action, details)` is
 * available in every handler, and command usage can be recorded automatically.
 *
 * @module audit
 */
import comfort from "@ix-xs/node-comfort";
import { createLogger, type Logger } from "./logger.js";
import type { KVStore } from "./store.js";

/** A single audit record. */
export interface AuditEntry {
  /** Unique id. */
  id: string;
  /** Unix ms. */
  timestamp: number;
  /** What happened, e.g. `"member.ban"` or `"command:ban"`. */
  action: string;
  /** Who did it. */
  actorId?: string;
  /** Who/what it was done to. */
  targetId?: string;
  /** Where. */
  guildId?: string | null;
  /** Arbitrary structured context. */
  metadata?: Record<string, unknown>;
}

/** A destination audit entries are written to. */
export interface AuditSink {
  record(entry: AuditEntry): void | Promise<void>;
  /** Optional read support, enabling {@link AuditLog.query}. */
  query?(): AuditEntry[] | Promise<AuditEntry[]>;
}

/** Filter for {@link AuditLog.query}. */
export interface AuditFilter {
  action?: string;
  actorId?: string;
  guildId?: string;
  /** Only entries at/after this Unix ms. */
  since?: number;
  /** Max entries (newest first). */
  limit?: number;
}

/** A configured audit log. */
export interface AuditLog {
  /** Records an entry (id/timestamp filled in for you). */
  record(action: string, data?: Omit<Partial<AuditEntry>, "action">): Promise<AuditEntry>;
  /** Queries entries (newest first) from the first read-capable sink. */
  query(filter?: AuditFilter): Promise<AuditEntry[]>;
}

function applyFilter(entries: AuditEntry[], filter: AuditFilter = {}): AuditEntry[] {
  let out = entries.filter(
    (e) =>
      (filter.action === undefined || e.action === filter.action) &&
      (filter.actorId === undefined || e.actorId === filter.actorId) &&
      (filter.guildId === undefined || e.guildId === filter.guildId) &&
      (filter.since === undefined || e.timestamp >= filter.since),
  );
  out = out.sort((a, b) => b.timestamp - a.timestamp);
  return filter.limit ? out.slice(0, filter.limit) : out;
}

/** An in-memory sink (bounded ring buffer). */
export function memoryAuditSink(max = 5000): AuditSink {
  const entries: AuditEntry[] = [];
  return {
    record(entry) {
      entries.push(entry);
      if (entries.length > max) entries.shift();
    },
    query: () => [...entries],
  };
}

/** A sink that persists entries in a {@link KVStore} (one key per entry). */
export function storeAuditSink(store: KVStore, options: { namespace?: string; ttl?: number | string } = {}): AuditSink {
  const ns = store.namespace(options.namespace ?? "audit");
  return {
    async record(entry) {
      await ns.set(entry.id, entry as unknown as never, options.ttl);
    },
    async query() {
      const keys = await ns.keys();
      const rows = await Promise.all(keys.map((k) => ns.get(k)));
      return rows.filter(Boolean) as unknown as AuditEntry[];
    },
  };
}

/**
 * A sink that writes each entry to the structured logger. Pass your own logger,
 * or omit it to use a default one - so `loggerAuditSink()` just works in config.
 */
export function loggerAuditSink(logger: Logger = createLogger()): AuditSink {
  return {
    record(entry) {
      logger.info({ audit: entry }, `audit: ${entry.action}`);
    },
  };
}

/** Options for {@link createAuditLog}. */
export interface AuditLogOptions {
  /** A single sink. */
  sink?: AuditSink;
  /** Multiple sinks (all receive every entry). */
  sinks?: AuditSink[];
}

/**
 * Creates an {@link AuditLog}. Defaults to an in-memory sink if none is given.
 * @example const audit = createAuditLog({ sinks: [loggerAuditSink(logger), storeAuditSink(store)] });
 */
export function createAuditLog(options: AuditLogOptions = {}): AuditLog {
  const sinks = [...(options.sink ? [options.sink] : []), ...(options.sinks ?? [])];
  if (sinks.length === 0) sinks.push(memoryAuditSink());

  return {
    async record(action, data = {}) {
      const entry: AuditEntry = { id: comfort.id.nano(12), timestamp: Date.now(), action, ...data };
      // Best-effort: a failing sink (e.g. a transient store error) must never
      // break the command that recorded the entry. Failures are swallowed here;
      // add a logger sink if you want them surfaced.
      await Promise.allSettled(sinks.map((s) => s.record(entry)));
      return entry;
    },
    async query(filter) {
      for (const sink of sinks) {
        if (sink.query) return applyFilter(await sink.query(), filter);
      }
      return [];
    },
  };
}
