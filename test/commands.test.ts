import { describe, it, expect } from "vitest";
import {
  defineCommand,
  subcommand,
  defineUserCommand,
  defineMessageCommand,
  defineTrigger,
  defineSelectMenu,
  defineUserSelect,
  defineRoleSelect,
  defineChannelSelect,
  defineMentionableSelect,
  s,
  Registry,
} from "../src/index.js";
import { buildCommandTree, commandToJSON, planDeployment, canonical } from "../src/deploy.js";

describe("subcommands", () => {
  const Config = defineCommand({
    name: "config",
    description: "cfg",
    subcommands: {
      set: subcommand({
        description: "set",
        options: { key: s.string({ required: true }) },
        run: () => {},
      }),
    },
    groups: {
      role: {
        description: "roles",
        subcommands: { add: subcommand({ description: "add", run: () => {} }) },
      },
    },
  });

  it("builds nested subcommand + group option JSON", () => {
    const json = commandToJSON(Config) as unknown as {
      options: Array<{ type: number; name: string; options?: unknown[] }>;
    };
    const names = json.options.map((o) => o.name).sort();
    expect(names).toEqual(["role", "set"]);
    const group = json.options.find((o) => o.name === "role")!;
    expect(group.type).toBe(2); // SubcommandGroup
    expect((group.options as Array<{ name: string }>)[0]!.name).toBe("add");
  });
});

describe("context menu commands", () => {
  it("registers user + message commands and deploys with the right type", () => {
    const registry = new Registry();
    registry.add(defineUserCommand({ name: "User info", run: () => {} }));
    registry.add(defineMessageCommand({ name: "Report", run: () => {} }));

    expect(registry.userCommands.size).toBe(1);
    expect(registry.messageCommands.size).toBe(1);

    const tree = buildCommandTree(registry) as unknown as Array<{ name: string; type: number; description: string }>;
    expect(tree.find((c) => c.name === "User info")!.type).toBe(2); // User
    expect(tree.find((c) => c.name === "Report")!.type).toBe(3); // Message
    // Context menu commands must have an empty description.
    expect(tree.find((c) => c.name === "Report")!.description).toBe("");
  });
});

describe("install & interaction contexts", () => {
  it("maps integrationTypes/contexts to Discord's numeric enums", () => {
    const Cmd = defineCommand({
      name: "note",
      description: "user-installable",
      integrationTypes: ["guild", "user"],
      contexts: ["guild", "botDm", "privateChannel"],
      run: () => {},
    });
    const json = commandToJSON(Cmd) as unknown as { integration_types: number[]; contexts: number[] };
    expect(json.integration_types).toEqual([0, 1]); // GuildInstall, UserInstall
    expect(json.contexts).toEqual([0, 1, 2]); // Guild, BotDM, PrivateChannel
  });
});

describe("deployment scoping", () => {
  it("partitions commands into global and per-guild targets", () => {
    const registry = new Registry();
    registry.add(defineCommand({ name: "help", description: "global", run: () => {} }));
    registry.add(defineCommand({ name: "eval", description: "dev only", guilds: ["G1"], run: () => {} }));
    registry.add(defineCommand({ name: "beta", description: "two guilds", guilds: ["G1", "G2"], run: () => {} }));

    const plan = planDeployment(registry);
    expect(plan.global.map((c) => c.name)).toEqual(["help"]);
    expect(plan.guilds.get("G1")!.map((c) => c.name).sort()).toEqual(["beta", "eval"]);
    expect(plan.guilds.get("G2")!.map((c) => c.name)).toEqual(["beta"]);
  });

  it("puts everything global when no command is scoped", () => {
    const registry = new Registry();
    registry.add(defineCommand({ name: "a", description: "a", run: () => {} }));
    registry.add(defineCommand({ name: "b", description: "b", run: () => {} }));
    const plan = planDeployment(registry);
    expect(plan.global).toHaveLength(2);
    expect(plan.guilds.size).toBe(0);
  });
});

describe("triggers", () => {
  it("registers and derives message intents", () => {
    const registry = new Registry();
    registry.add(defineTrigger({ name: "pong", pattern: "ping", run: () => {} }));
    expect(registry.triggers).toHaveLength(1);
    expect(registry.triggers[0]!.mode).toBe("includes");
  });
});

describe("autocomplete & localizations", () => {
  it("marks the option autocomplete and emits localizations", () => {
    const Cmd = defineCommand({
      name: "search",
      description: "Search",
      nameLocalizations: { fr: "recherche" },
      options: {
        query: s.string({
          description: "Query",
          nameLocalizations: { fr: "requête" },
          autocomplete: () => [{ name: "a", value: "a" }],
        }),
      },
      run: () => {},
    });
    const json = commandToJSON(Cmd) as unknown as {
      name_localizations: Record<string, string>;
      options: Array<{ autocomplete?: boolean; name_localizations?: Record<string, string> }>;
    };
    expect(json.name_localizations).toEqual({ fr: "recherche" });
    expect(json.options[0]!.autocomplete).toBe(true);
    expect(json.options[0]!.name_localizations).toEqual({ fr: "requête" });
  });
});

describe("deploy diff (canonical)", () => {
  const withSub = (subDesc: string, extraOpt = false) =>
    commandToJSON(
      defineCommand({
        name: "cfg",
        description: "configure",
        subcommands: {
          set: subcommand({
            description: subDesc,
            options: extraOpt
              ? { key: s.string({ description: "k", required: true }), value: s.string({ description: "v" }) }
              : { key: s.string({ description: "k", required: true }) },
            run: () => {},
          }),
        },
      }),
    );

  it("detects a changed subcommand description (nested)", () => {
    expect(canonical(withSub("old"))).not.toBe(canonical(withSub("new")));
  });

  it("detects an added subcommand option (nested)", () => {
    expect(canonical(withSub("same"))).not.toBe(canonical(withSub("same", true)));
  });

  it("is stable for identical commands", () => {
    expect(canonical(withSub("same"))).toBe(canonical(withSub("same")));
  });
});

describe("native selects", () => {
  it("registers user/role/channel/mentionable selects under one map", () => {
    const registry = new Registry();
    registry.add(defineUserSelect({ id: "u", run: () => {} }));
    registry.add(defineRoleSelect({ id: "r", run: () => {} }));
    registry.add(defineChannelSelect({ id: "c", run: () => {} }));
    registry.add(defineMentionableSelect({ id: "m", run: () => {} }));
    registry.add(defineSelectMenu({ id: "s", run: () => {} }));
    expect(registry.selectMenus.size).toBe(5);
    expect(registry.selectMenus.get("u")!.selectType).toBe("user");
    expect(registry.selectMenus.get("c")!.selectType).toBe("channel");
  });
});
