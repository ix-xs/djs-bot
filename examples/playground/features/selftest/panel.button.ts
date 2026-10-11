import { ButtonStyle, MessageFlags, confirm, defineButton, p } from "../../../../src/index.js";
import { FormA, FormB } from "./forms.modal.js";
import { report } from "./report.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Opens form A. A modal must be the first response, so no automatic deferral here. */
export const OpenFormA = defineButton({
  id: "selftest:open-a",
  label: "1. Form A",
  emoji: "📝",
  style: ButtonStyle.Primary,
  defer: false,
  run: (ctx) => ctx.showModal(FormA, { opener: ctx.user.id }),
});

export const OpenFormB = defineButton({
  id: "selftest:open-b",
  label: "2. Form B",
  emoji: "📋",
  style: ButtonStyle.Primary,
  defer: false,
  run: (ctx) => ctx.showModal(FormB),
});

/**
 * Works for 3 seconds before answering. With `defer: "update"` the click is
 * acknowledged silently after 2 s, and `ctx.update` then edits the message.
 */
export const SlowUpdate = defineButton({
  id: "selftest:slow-update",
  label: "3. Slow update",
  emoji: "🐢",
  style: ButtonStyle.Secondary,
  defer: "update",
  run: async (ctx) => {
    const started = Date.now();
    await sleep(3000);
    const acknowledged = ctx.interaction.deferred;
    await ctx.update({
      content: report(ctx, "Slow update", [
        ["the click was acknowledged for me after 2 s", acknowledged],
        ["ctx.update edited this message after the deferral", true, `${Date.now() - started} ms`],
      ]),
    });
  },
});

/** A counter kept in the store. `increment` cannot lose a click, however fast you go. */
export const Counter = defineButton({
  id: "selftest:counter",
  params: { by: p.number },
  label: "4. Count",
  emoji: "➕",
  style: ButtonStyle.Success,
  run: async (ctx) => {
    const total = await ctx.services.store.namespace<number>("selftest").increment("clicks", ctx.params.by);
    await ctx.reply.ephemeral(
      report(ctx, "Counter", [
        ["the typed param arrived as a number", typeof ctx.params.by === "number", String(ctx.params.by)],
        ["store.increment returned the new total", Number.isInteger(total) && total >= ctx.params.by, String(total)],
      ]),
    );
  },
});

/** A yes/no dialog, with the button labels taken from `messages`. */
export const Ask = defineButton({
  id: "selftest:confirm",
  label: "5. Confirm",
  emoji: "❓",
  style: ButtonStyle.Secondary,
  defer: false,
  run: async (ctx) => {
    const answer = await confirm(ctx, { content: "The buttons below should read **Oui** and **Non**. Did they?" });
    await ctx.reply.followUp({
      content: report(ctx, "Confirm", [["confirm() resolved to a boolean", typeof answer === "boolean", String(answer)]]),
      flags: MessageFlags.Ephemeral,
    });
  },
});
