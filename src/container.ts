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

/**
 * A service definition. Create one with {@link defineService}.
 * @typeParam T The shape the factory produces.
 */
export interface ServiceDefinition<T = unknown> {
  readonly kind: "service";
  /** Unique token used to resolve and inject the service. */
  readonly name: string;
  /** Names of other services injected into `factory`. */
  readonly deps: readonly string[];
  /** Builds the service instance from its resolved dependencies. */
  readonly factory: (resolved: Record<string, unknown>) => unknown | Promise<unknown>;
}

/**
 * Global service map. Augment it in your project for end-to-end typing:
 * @example
 * declare module "@ix-xs/djs-bot" {
 *   interface ServiceMap { db: MyDb; tickets: TicketsService }
 * }
 */
export interface ServiceMap {
  [token: string]: unknown;
}

/** Resolves service definitions and holds their singleton instances. */
export class Container {
  private readonly defs = new Map<string, ServiceDefinition>();
  private readonly instances = new Map<string, unknown>();
  private resolving = new Set<string>();

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

  /**
   * Resolves a single service, instantiating its dependency graph on demand.
   * @throws {BotError} `DJSBOT_E031` if unknown, `DJSBOT_E030` on a cycle.
   */
  public async resolve(name: string): Promise<unknown> {
    if (this.instances.has(name)) return this.instances.get(name);

    const def = this.defs.get(name);
    if (!def) throw new BotError("DJSBOT_E031", { detail: `service "${name}"` });

    if (this.resolving.has(name)) {
      throw new BotError("DJSBOT_E030", {
        detail: `dependency cycle involving "${name}"`,
        meta: { chain: [...this.resolving, name] },
      });
    }
    this.resolving.add(name);

    const resolved: Record<string, unknown> = {};
    for (const dep of def.deps) resolved[dep] = await this.resolve(dep);

    const instance = await def.factory(resolved);
    this.instances.set(name, instance);
    this.resolving.delete(name);
    return instance;
  }

  /** Resolves every registered definition eagerly (call once at boot). */
  public async resolveAll(): Promise<void> {
    for (const name of this.defs.keys()) await this.resolve(name);
  }

  /**
   * A live, read-only view of resolved services, safe to expose as
   * `ctx.services`. Missing tokens throw a helpful error on access.
   */
  public view(): ServiceMap {
    const instances = this.instances;
    return new Proxy({} as ServiceMap, {
      get(_t, prop: string) {
        if (!instances.has(prop)) {
          throw new BotError("DJSBOT_E031", { detail: `service "${prop}"` });
        }
        return instances.get(prop);
      },
      has(_t, prop: string) {
        return instances.has(prop);
      },
    });
  }
}
