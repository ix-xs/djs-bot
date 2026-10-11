/**
 * A deliberately small dependency-injection container.
 *
 * No decorators, no `reflect-metadata`, no import-order magic - dependencies are
 * declared explicitly as string tokens and resolved in topological order at
 * boot. What you register is exactly what you get, and `djs-bot explain` can
 * print the whole graph.
 *
 * @module container
 */
import { BotError } from "./errors.js";
import type { KVStore } from "./store.js";
import type { AuditLog } from "./audit.js";
import type { FeatureFlags } from "./flags.js";

/**
 * A service definition. Create one with {@link defineService}.
 * @typeParam T The shape the factory produces.
 */
export interface ServiceDefinition<T = unknown> {
  /** Marks the object as a service for the loader. */
  readonly kind: "service";
  /** Unique token used to resolve and inject the service. */
  readonly name: string;
  /** Names of other services injected into `factory`. */
  readonly deps: readonly string[];
  /** Builds the service instance from its resolved dependencies. */
  readonly factory: (resolved: Record<string, unknown>) => unknown | Promise<unknown>;
  /** Releases the instance during graceful shutdown (close a pool, flush a buffer). */
  readonly dispose?: (instance: unknown) => unknown | Promise<unknown>;
}

/**
 * Global service map. Augment it in your project for end-to-end typing:
 * @example
 * declare module "@ix-xs/djs-bot" {
 *   interface ServiceMap { db: MyDb; tickets: TicketsService }
 * }
 *
 * The three services the framework registers itself are already typed. Reading
 * one that is not configured throws `DJSBOT_E031`, like any unknown token.
 */
export interface ServiceMap {
  /** The store from `defineBot({ store })`. */
  store: KVStore;
  /** The audit log from `defineBot({ audit })`. */
  audit: AuditLog;
  /** The feature flags from `defineBot({ flags })`. */
  flags: FeatureFlags;
  [token: string]: unknown;
}

/** Resolves service definitions and holds their singleton instances. */
export class Container {
  private readonly defs = new Map<string, ServiceDefinition>();
  private readonly instances = new Map<string, unknown>();
  private readonly resolving = new Set<string>();
  /** Tokens in the order their instances were built, to dispose in reverse. */
  private readonly built: string[] = [];
  private cachedView?: ServiceMap;

  /** Registers a service definition. */
  public register(def: ServiceDefinition): void {
    this.defs.set(def.name, def);
  }

  /** Registers an already-built value under a token (used by plugins). */
  public registerValue(name: string, value: unknown): void {
    this.instances.set(name, value);
  }

  /** Whether a token is known (as a definition or a value). */
  public has(name: string): boolean {
    return this.defs.has(name) || this.instances.has(name);
  }

  /** All registered service tokens. */
  public tokens(): string[] {
    return [...new Set([...this.defs.keys(), ...this.instances.keys()])];
  }

  private unknown(name: string): BotError {
    const known = this.tokens();
    return new BotError("DJSBOT_E031", {
      detail: `service "${name}"`,
      hint: known.length
        ? `Requested a service that was never registered. Known services: ${known.join(", ")}.`
        : "Requested a service, but none is registered. Define one with defineService(), or set store/audit/flags in defineBot().",
    });
  }

  /**
   * Resolves a single service, instantiating its dependency graph on demand.
   * @throws {BotError} `DJSBOT_E031` if unknown, `DJSBOT_E030` on a cycle.
   */
  public async resolve(name: string): Promise<unknown> {
    if (this.instances.has(name)) return this.instances.get(name);

    const def = this.defs.get(name);
    if (!def) throw this.unknown(name);

    if (this.resolving.has(name)) {
      throw new BotError("DJSBOT_E030", {
        detail: `dependency cycle: ${[...this.resolving, name].join(" -> ")}`,
        meta: { chain: [...this.resolving, name] },
      });
    }
    this.resolving.add(name);
    try {
      const resolved: Record<string, unknown> = {};
      for (const dep of def.deps) resolved[dep] = await this.resolve(dep);

      const instance = await def.factory(resolved);
      this.instances.set(name, instance);
      this.built.push(name);
      return instance;
    } finally {
      // Also on failure: a factory that threw must not look like a cycle later.
      this.resolving.delete(name);
    }
  }

  /** Resolves every registered definition eagerly (call once at boot). */
  public async resolveAll(): Promise<void> {
    for (const name of this.defs.keys()) await this.resolve(name);
  }

  /**
   * Runs the `dispose` hook of every built service, most recently built first
   * (so a service is disposed before the ones it depends on). A failing hook is
   * reported through `onError` and does not stop the others.
   */
  public async disposeAll(onError?: (error: unknown, token: string) => void): Promise<void> {
    for (const name of [...this.built].reverse()) {
      const dispose = this.defs.get(name)?.dispose;
      if (!dispose) continue;
      try {
        await dispose(this.instances.get(name));
      } catch (error) {
        onError?.(error, name);
      }
    }
    this.built.length = 0;
  }

  /**
   * A live, read-only view of resolved services, safe to expose as
   * `ctx.services`. Missing tokens throw a helpful error on access.
   */
  public view(): ServiceMap {
    if (this.cachedView) return this.cachedView;
    const instances = this.instances;
    const unknown = (name: string): BotError => this.unknown(name);
    this.cachedView = new Proxy({} as ServiceMap, {
      get(_target, prop) {
        // Symbols and `then` are probed by `await`, `console.log` and test
        // matchers; they are never service tokens, so they must not throw.
        if (typeof prop !== "string" || prop === "then" || prop === "toJSON") return undefined;
        if (!instances.has(prop)) throw unknown(prop);
        return instances.get(prop);
      },
      has(_target, prop) {
        return typeof prop === "string" && instances.has(prop);
      },
      ownKeys() {
        return [...instances.keys()];
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop !== "string" || !instances.has(prop)) return undefined;
        return { enumerable: true, configurable: true, value: instances.get(prop) };
      },
    });
    return this.cachedView;
  }
}
