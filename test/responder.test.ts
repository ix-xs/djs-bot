import { describe, it, expect, vi, afterEach } from "vitest";
import { MessageFlags } from "discord.js";
import { createResponder, describeInteraction, resolveDefer } from "../src/context.js";
import { field, defineModal } from "../src/index.js";
import { fakeInteraction, methods } from "./fakes.js";

const responder = (interaction: ReturnType<typeof fakeInteraction>) => createResponder(interaction as never);
const flagsOf = (call: { payload?: unknown } | undefined) => (call?.payload as { flags?: number } | undefined)?.flags;

describe("resolveDefer", () => {
  it("turns each form into concrete values", () => {
    expect(resolveDefer(undefined)).toBeUndefined();
    expect(resolveDefer(false)).toBeUndefined();
    expect(resolveDefer(true)).toEqual({ ephemeral: false, update: false, afterMs: 2000 });
    expect(resolveDefer("ephemeral")).toEqual({ ephemeral: true, update: false, afterMs: 2000 });
    expect(resolveDefer("update")).toEqual({ ephemeral: false, update: true, afterMs: 2000 });
    expect(resolveDefer({ after: "500ms", ephemeral: true })).toEqual({ ephemeral: true, update: false, afterMs: 500 });
    expect(resolveDefer({ after: 0 })).toEqual({ ephemeral: false, update: false, afterMs: 0 });
  });
});

describe("ctx.reply", () => {
  it("replies, then follows up on later calls", async () => {
    const i = fakeInteraction();
    const { reply } = responder(i);
    await reply("one");
    await reply("two");
    expect(methods(i)).toEqual(["reply", "followUp"]);
  });

  it("edits the deferred reply instead of replying again", async () => {
    const i = fakeInteraction();
    const { reply } = responder(i);
    await reply.defer({ ephemeral: true });
    await reply.success("done");
    expect(methods(i)).toEqual(["deferReply", "editReply"]);
    expect(flagsOf(i.calls[0])).toBe(MessageFlags.Ephemeral);
  });

  it("makes errors ephemeral by default, and the others public", async () => {
    const a = fakeInteraction();
    await responder(a).reply.error("no");
    expect(flagsOf(a.calls[0])).toBe(MessageFlags.Ephemeral);

    const b = fakeInteraction();
    await responder(b).reply.warn("careful");
    expect(flagsOf(b.calls[0])).toBeUndefined();

    const c = fakeInteraction();
    await responder(c).reply.error("public", { ephemeral: false });
    expect(flagsOf(c.calls[0])).toBeUndefined();
  });

  it("adds the ephemeral bit without dropping other flags", async () => {
    const i = fakeInteraction();
    await responder(i).reply.ephemeral({ content: "x", flags: MessageFlags.SuppressEmbeds });
    expect(flagsOf(i.calls[0])).toBe(MessageFlags.SuppressEmbeds | MessageFlags.Ephemeral);
  });

  it("ignores a second defer", async () => {
    const i = fakeInteraction();
    const { reply } = responder(i);
    await reply.defer();
    await reply.defer();
    expect(methods(i)).toEqual(["deferReply"]);
  });

  it("fetches and deletes the reply", async () => {
    const i = fakeInteraction();
    const { reply } = responder(i);
    await reply("hi");
    expect(await reply.fetch()).toEqual({ id: "reply-1" });
    await reply.delete();
    expect(methods(i)).toEqual(["reply", "fetchReply", "deleteReply"]);
  });
});

describe("automatic deferral", () => {
  afterEach(() => vi.useRealTimers());

  it("defers a handler that is still working after the delay", async () => {
    vi.useFakeTimers();
    const i = fakeInteraction();
    const r = responder(i);
    r.armDefer({ ephemeral: false, update: false, afterMs: 2000 });

    await vi.advanceTimersByTimeAsync(1999);
    expect(methods(i)).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(methods(i)).toEqual(["deferReply"]);

    await r.reply.success("finally");
    expect(methods(i)).toEqual(["deferReply", "editReply"]);
  });

  it("never fires when the handler answered in time", async () => {
    vi.useFakeTimers();
    const i = fakeInteraction();
    const r = responder(i);
    r.armDefer({ ephemeral: false, update: false, afterMs: 2000 });
    await r.reply("fast");
    await vi.advanceTimersByTimeAsync(5000);
    expect(methods(i)).toEqual(["reply"]);
  });

  it("cannot collide with a reply sent at the same instant", async () => {
    const i = fakeInteraction();
    const r = responder(i);
    // Deferral and reply are requested back to back: without the queue the
    // second acknowledgement would throw InteractionAlreadyReplied.
    r.armDefer({ ephemeral: false, update: false, afterMs: 0 });
    await r.reply("hello");
    expect(methods(i)).toEqual(["deferReply", "editReply"]);
  });

  it("is disarmed by showModal, which must be the first response", async () => {
    vi.useFakeTimers();
    const i = fakeInteraction();
    const r = responder(i);
    const modal = defineModal({ id: "m", title: "M", fields: { a: field.short({ label: "A" }) }, run: () => undefined });
    r.armDefer({ ephemeral: false, update: false, afterMs: 2000 });
    await r.showModal(modal);
    await vi.advanceTimersByTimeAsync(5000);
    expect(methods(i)).toEqual(["showModal"]);
  });

  it("acknowledges a component with deferUpdate in update mode", async () => {
    const i = fakeInteraction({ kind: "button", customId: "x" });
    const r = responder(i);
    r.armDefer({ ephemeral: false, update: true, afterMs: 0 });
    await r.update!({ content: "edited" });
    expect(methods(i)).toEqual(["deferUpdate", "editReply"]);
  });

  it("swallows a deferral on an interaction that is already gone", async () => {
    const i = fakeInteraction();
    i.deferReply = async () => {
      throw new Error("Unknown interaction");
    };
    const r = responder(i);
    r.armDefer({ ephemeral: false, update: false, afterMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 5)); // no unhandled rejection
    expect(i.deferred).toBe(false);
  });
});

describe("ctx.update", () => {
  it("updates the message, or edits it once the interaction was deferred", async () => {
    const a = fakeInteraction({ kind: "button", customId: "x" });
    await responder(a).update!("now");
    expect(methods(a)).toEqual(["update"]);

    const b = fakeInteraction({ kind: "select", customId: "x" });
    const r = responder(b);
    await r.update!.defer();
    await r.update!("later"); // used to throw InteractionAlreadyReplied
    await r.update!.disable();
    expect(methods(b)).toEqual(["deferUpdate", "editReply", "editReply"]);
  });

  it("does not exist on non-component interactions", () => {
    expect(responder(fakeInteraction()).update).toBeUndefined();
  });
});

describe("describeInteraction", () => {
  it("names commands with their subcommand, and components by routing id", () => {
    expect(describeInteraction(fakeInteraction({ commandName: "config", group: "role", subcommand: "add" }) as never)).toEqual({
      kind: "command",
      name: "config role add",
    });
    expect(describeInteraction(fakeInteraction({ kind: "button", customId: "ticket:close$WyI0MiJd" }) as never)).toEqual({
      kind: "button",
      name: "ticket:close",
    });
    expect(describeInteraction(fakeInteraction({ kind: "modal", customId: "feedback" }) as never)).toEqual({
      kind: "modal",
      name: "feedback",
    });
  });
});
