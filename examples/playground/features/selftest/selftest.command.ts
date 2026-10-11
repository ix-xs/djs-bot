import {
  Colors,
  EmbedBuilder,
  MessageFlags,
  cooldown,
  defineCommand,
  inGuild,
  paginate,
  s,
  subcommand,
  timestamp,
  TimestampStyles,
  ui,
} from "../../../../src/index.js";
import { Ask, Counter, OpenFormA, OpenFormB, SlowUpdate } from "./panel.button.js";
import { report } from "./report.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 *   /selftest panel      the buttons that drive the interactive checks
 *   /selftest slow       automatic deferral
 *   /selftest cooldown   a guard refusing, in the configured wording
 *   /selftest upload     an attachment option restricted to images
 *   /selftest pages      pagination
 *   /selftest card       a Components V2 message
 *   /selftest poll       a native poll
 *   /selftest whoami     what ctx knows about you
 *   /selftest boom       the error boundary
 */
export default defineCommand({
  name: "selftest",
  description: "Exercise the framework, one feature at a time",
  guards: [inGuild()],
  subcommands: {
    panel: subcommand({
      description: "Post the interactive test panel",
      run: (ctx) =>
        ctx.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("djs-bot self-test")
              .setColor(Colors.Blurple)
              .setDescription(
                [
                  "Click each button. Every step answers with its own checklist.",
                  "",
                  "**1-2** open a modal, fill it in, submit.",
                  "**3** takes 3 seconds on purpose.",
                  "**4** counts clicks in the store.",
                  "**5** asks you a yes/no question.",
                ].join("\n"),
              ),
          ],
          components: [
            ui.row(OpenFormA.build(), OpenFormB.build(), SlowUpdate.build(), Counter.build({ by: 1 }), Ask.build()),
          ],
        }),
    }),

    slow: subcommand({
      description: "Take a while to answer: the framework defers for you",
      options: { seconds: s.integer({ description: "How long to work", min: 1, max: 10 }) },
      run: async (ctx) => {
        const seconds = ctx.options.seconds ?? 4;
        await sleep(seconds * 1000);
        // No defer() anywhere in this handler: `defaults: { defer: true }` did it.
        await ctx.reply.success(
          report(ctx, "Automatic deferral", [
            [`worked for ${seconds}s without calling defer()`, true],
            ["the interaction was deferred on my behalf", ctx.interaction.deferred || seconds < 2],
          ]),
        );
      },
    }),

    cooldown: subcommand({
      description: "Run it twice: the second time is refused in the configured wording",
      guards: [cooldown("15s")],
      run: (ctx) => ctx.reply.info("First run accepted. Run it again within 15 seconds to see the refusal."),
    }),

    upload: subcommand({
      description: "Attach an image: the option only accepts images",
      options: { image: s.attachment({ description: "An image", required: true, fileTypes: ["image"] }) },
      run: (ctx) => {
        const file = ctx.options.image;
        return ctx.reply.ephemeral(
          report(ctx, "Attachment option", [
            ["received an attachment", Boolean(file?.url), file.name],
            ["it is an image, as the fileTypes filter requires", (file.contentType ?? "").startsWith("image/"), file.contentType ?? "?"],
          ]),
        );
      },
    }),

    pages: subcommand({
      description: "A paginated message built lazily",
      run: (ctx) =>
        paginate(ctx, {
          count: 5,
          ephemeral: true,
          pages: (index) =>
            new EmbedBuilder()
              .setTitle(`Page ${index + 1} of 5`)
              .setColor(Colors.Blurple)
              .setDescription("Use the arrows. Each page is built only when you reach it."),
        }),
    }),

    card: subcommand({
      description: "A Components V2 message",
      run: (ctx) =>
        ctx.reply({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: [
            ui.container(
              { accent: Colors.Fuchsia },
              ui.text(`## Components V2\nHello ${ctx.user}`),
              ui.separator({ divider: true }),
              ui.section({
                text: ["A section with a thumbnail", `Rendered ${timestamp(Date.now(), TimestampStyles.RelativeTime)}`],
                accessory: ui.thumbnail(ctx.user.displayAvatarURL({ size: 128 })),
              }),
              ui.row(Counter.build({ by: 10 }, { label: "Count +10" })),
            ),
          ],
        }),
    }),

    poll: subcommand({
      description: "A native poll",
      run: (ctx) => ctx.reply({ poll: ui.poll("Does the framework work?", ["Yes", { text: "Obviously", emoji: "✅" }], { hours: 1 }) }),
    }),

    whoami: subcommand({
      description: "What ctx knows about this interaction",
      run: (ctx) =>
        ctx.reply.ephemeral(
          report(ctx, "Context", [
            ["ctx.member is a cached guild member", ctx.member !== null, ctx.member?.displayName],
            ["ctx.channelId is set", typeof ctx.channelId === "string", ctx.channelId ?? "none"],
            ["ctx.locale is your Discord language", ctx.locale.length >= 2, ctx.locale],
            ["Discord sent your permissions for this channel", ctx.interaction.memberPermissions !== null],
            ["Discord sent the bot's permissions for this channel", ctx.interaction.appPermissions !== null],
            ["ctx.say renders the configured wording", ctx.say("cooldown", { seconds: 3 }).includes("3"), ctx.say("cooldown", { seconds: 3 })],
            ["ctx.services.store is available", typeof ctx.services.store.increment === "function"],
          ]),
        ),
    }),

    boom: subcommand({
      description: "Throw on purpose: you should get a clean error message",
      run: () => {
        throw new Error("selftest: this error is intentional");
      },
    }),
  },
});
