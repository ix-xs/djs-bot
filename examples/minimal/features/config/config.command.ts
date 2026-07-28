import { defineCommand, subcommand, s, inGuild, hasPermission, PermissionFlagsBits } from "../../../../src/index.js";

/**
 * A command with subcommands and a subcommand group. Each subcommand has its
 * own typed options; `ctx.options` is precise inside each `run`.
 *
 *   /config view
 *   /config set  key:<...> value:<...>
 *   /config role add    role:<@role>
 *   /config role remove role:<@role>
 */
export default defineCommand({
  name: "config",
  description: "Manage server configuration",
  guards: [inGuild(), hasPermission(PermissionFlagsBits.ManageGuild)],
  subcommands: {
    view: subcommand({
      description: "Show the current configuration",
      run: (ctx) => ctx.reply.info("Config: (nothing set yet)"),
    }),
    set: subcommand({
      description: "Set a configuration value",
      options: {
        key: s.string({ description: "Key", required: true }),
        value: s.string({ description: "Value", required: true }),
      },
      run: (ctx) => ctx.reply.success(`Set **${ctx.options.key}** = \`${ctx.options.value}\``),
    }),
  },
  groups: {
    role: {
      description: "Manage auto-roles",
      subcommands: {
        add: subcommand({
          description: "Add an auto-role",
          options: { role: s.role({ description: "Role", required: true }) },
          run: (ctx) => ctx.reply.success(`Added ${ctx.options.role}`),
        }),
        remove: subcommand({
          description: "Remove an auto-role",
          options: { role: s.role({ description: "Role", required: true }) },
          run: (ctx) => ctx.reply.success(`Removed ${ctx.options.role}`),
        }),
      },
    },
  },
});
