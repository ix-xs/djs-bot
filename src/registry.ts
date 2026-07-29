/**
 * The central, inspectable registry.
 *
 * Everything the framework knows about lives here: commands, components, events,
 * jobs, services, plugins and features. It is the single source of truth for
 * routing, deployment and `djs-bot explain`. Registration is explicit - nothing
 * is added by import side effects.
 *
 * @module registry
 */
import { BotError } from "./errors.js";
import type { ServiceDefinition } from "./container.js";
import type {
  AnyDefinition,
  ButtonDefinition,
  CommandDefinition,
  EventDefinition,
  FeatureDefinition,
  JobDefinition,
  MessageCommandDefinition,
  ModalDefinition,
  PluginDefinition,
  SelectRoutable,
  TriggerDefinition,
  UserCommandDefinition,
} from "./definitions.js";

/** A registrable item: any definition or a whole feature. */
export type Registrable = AnyDefinition | FeatureDefinition;

/** Holds every definition and exposes typed lookups. */
export class Registry {
  /** Slash commands by name. */
  public readonly commands = new Map<string, CommandDefinition>();
  /** User context-menu commands by name. */
  public readonly userCommands = new Map<string, UserCommandDefinition>();
  /** Message context-menu commands by name. */
  public readonly messageCommands = new Map<string, MessageCommandDefinition>();
  /** Buttons by routing key. */
  public readonly buttons = new Map<string, ButtonDefinition>();
  /** Select menus (string & native) by routing key. */
  public readonly selectMenus = new Map<string, SelectRoutable>();
  /** Modals by routing key. */
  public readonly modals = new Map<string, ModalDefinition>();
  /** Gateway event listeners. */
  public readonly events: EventDefinition[] = [];
  /** Message triggers (auto-responders). */
  public readonly triggers: TriggerDefinition[] = [];
  /** Scheduled jobs. */
  public readonly jobs: JobDefinition[] = [];
  /** Service definitions. */
  public readonly services: ServiceDefinition[] = [];
  /** Plugins. */
  public readonly plugins: PluginDefinition[] = [];
  /** Registered features (metadata). */
  public readonly features: FeatureDefinition[] = [];

  /** Registers any definition or feature, dispatching on `kind`. */
  public add(item: Registrable): void {
    switch (item.kind) {
      case "command":
        this.addCommand(item);
        break;
      case "userCommand":
        this.addComponent(this.userCommands, item.name, item, "user command");
        break;
      case "messageCommand":
        this.addComponent(this.messageCommands, item.name, item, "message command");
        break;
      case "button":
        this.addComponent(this.buttons, item.id, item, "button");
        break;
      case "select":
        this.addComponent(this.selectMenus, item.id, item, "select menu");
        break;
      case "modal":
        this.addComponent(this.modals, item.id, item, "modal");
        break;
      case "event":
        this.events.push(item);
        break;
      case "trigger":
        this.triggers.push(item);
        break;
      case "job":
        this.jobs.push(item);
        break;
      case "service":
        this.services.push(item);
        break;
      case "plugin":
        this.plugins.push(item);
        break;
      case "feature":
        this.addFeature(item);
        break;
      default: {
        const never: never = item;
        throw new BotError("DJSBOT_E060", { detail: `unknown definition kind: ${JSON.stringify(never)}` });
      }
    }
  }

  /** Registers many items at once. */
  public addAll(items: Iterable<Registrable>): void {
    for (const item of items) this.add(item);
  }

  private addCommand(command: CommandDefinition): void {
    if (this.commands.has(command.name)) {
      throw new BotError("DJSBOT_E010", { detail: `command "${command.name}"` });
    }
    this.commands.set(command.name, command);
  }

  private addComponent<T>(map: Map<string, T>, key: string, def: T, label: string): void {
    if (map.has(key)) {
      throw new BotError("DJSBOT_E011", { detail: `${label} "${key}"` });
    }
    map.set(key, def);
  }

  private addFeature(feature: FeatureDefinition): void {
    this.features.push(feature);
    feature.services.forEach((s) => this.add(s));
    feature.commands.forEach((c) => this.add(c));
    feature.userCommands.forEach((c) => this.add(c));
    feature.messageCommands.forEach((c) => this.add(c));
    feature.events.forEach((e) => this.add(e));
    feature.triggers.forEach((t) => this.add(t));
    feature.buttons.forEach((b) => this.add(b));
    feature.selectMenus.forEach((sm) => this.add(sm));
    feature.modals.forEach((m) => this.add(m));
    feature.jobs.forEach((j) => this.add(j));
    feature.plugins.forEach((pl) => this.add(pl));
  }

  /** A compact summary for diagnostics and `djs-bot explain`. */
  public summary(): {
    commands: number;
    userCommands: number;
    messageCommands: number;
    buttons: number;
    selectMenus: number;
    modals: number;
    events: number;
    triggers: number;
    jobs: number;
    services: number;
    plugins: number;
    features: number;
  } {
    return {
      commands: this.commands.size,
      userCommands: this.userCommands.size,
      messageCommands: this.messageCommands.size,
      buttons: this.buttons.size,
      selectMenus: this.selectMenus.size,
      modals: this.modals.size,
      events: this.events.length,
      triggers: this.triggers.length,
      jobs: this.jobs.length,
      services: this.services.length,
      plugins: this.plugins.length,
      features: this.features.length,
    };
  }
}
