// The scenes of the guide's Discord demos: what a page writes (`Step`), and
// what the player runs (`Action`). A page describes what happens in Discord
// in a few steps; the plan turns them into the elements to draw and the order
// in which they appear.

export interface Button {
  label: string;
  style?: "primary" | "secondary" | "success" | "danger";
  emoji?: string;
  disabled?: boolean;
}

export interface Embed {
  color?: string;
  title?: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: string;
  thumbnail?: boolean;
}

export interface Reply {
  author?: string;
  /** Message text. May contain `<b>`, `<code>`, mentions written `@Name`. */
  text?: string;
  embed?: Embed;
  buttons?: Button[];
  select?: { placeholder: string; options: { label: string; description?: string; emoji?: string }[] };
  /** Only the person who ran the command sees it. */
  ephemeral?: boolean;
  /** Shows "<bot> is thinking..." for this long first (a deferred reply). */
  thinking?: number;
  /** Replaces the last message instead of adding one (an edit, an update). */
  edit?: boolean;
}

export type Step =
  | {
      do: "command";
      name: string;
      description?: string;
      options?: { name: string; value: string; suggestions?: string[] }[];
      user?: string;
    }
  | { do: "say"; text: string; user?: string }
  | ({ do: "reply" } & Reply)
  | { do: "click"; button: string; user?: string }
  | { do: "choose"; option: string }
  | { do: "modal"; title: string; fields: { label: string; value: string; long?: boolean }[]; submit?: string }
  | { do: "join"; user: string }
  | { do: "wait"; ms: number };

/** What the player does, in order. Element ids are local to one demo. */
export type Action =
  | { a: "show"; id: string }
  | { a: "hide"; id: string }
  | { a: "type"; id: string; text: string }
  | { a: "clear"; id: string }
  | { a: "press"; id: string }
  | { a: "wait"; ms: number };

/** One element of the scene, as the component draws it. */
export type Piece =
  | { kind: "message"; id: string; user: boolean; author: string; used?: string; reply: Reply }
  | { kind: "user-message"; id: string; author: string; text: string }
  | { kind: "thinking"; id: string; author: string; used?: string }
  | { kind: "join"; id: string; user: string }
  | { kind: "picker"; id: string; name: string; description?: string }
  | { kind: "suggest"; id: string; option: string; values: string[]; picked: string }
  | { kind: "cmdline"; id: string; name: string; options: { id: string; name: string; value: string }[] }
  | { kind: "dropdown"; id: string; of: string; options: NonNullable<Reply["select"]>["options"]; picked: string; pickId: string }
  | { kind: "chosen"; id: string; of: string; label: string; emoji?: string }
  | { kind: "modal"; id: string; title: string; submit?: string; submitId: string; fields: { id: string; label: string; value: string; long?: boolean }[] };

export interface Plan {
  pieces: Piece[];
  actions: Action[];
  /** The pieces visible once the scene is over: what is drawn without the player. */
  final: Set<string>;
  /** What the input holds at the end ("" in every scene so far). */
  input: string;
}

const TYPE_GAP = 45;

export function plan(steps: Step[], bot = "djs-bot", defaultUser = "Jo"): Plan {
  const pieces: Piece[] = [];
  const actions: Action[] = [];
  const shown = new Set<string>();
  let n = 0;
  const id = (prefix: string) => `${prefix}${n++}`;
  const show = (target: string) => {
    actions.push({ a: "show", id: target });
    shown.add(target);
  };
  const hide = (target: string) => {
    actions.push({ a: "hide", id: target });
    shown.delete(target);
  };
  const wait = (ms: number) => actions.push({ a: "wait", ms });

  /** The last message of the bot: the one a click, a choice or an edit acts on. */
  let lastBot: Extract<Piece, { kind: "message" }> | undefined;
  /** The command that was just sent: the next reply shows "Jo used /name". */
  let pending: string | undefined;

  for (const step of steps) {
    switch (step.do) {
      case "command": {
        const user = step.user ?? defaultUser;
        const picker = id("picker");
        pieces.push({ kind: "picker", id: picker, name: step.name, description: step.description });
        actions.push({ a: "type", id: "input", text: "/" });
        show(picker);
        wait(250);
        actions.push({ a: "type", id: "input", text: step.name });
        wait(500);
        actions.push({ a: "press", id: picker });
        wait(150);
        hide(picker);
        actions.push({ a: "clear", id: "input" });
        const line = id("cmd");
        const options = (step.options ?? []).map((option) => ({ id: id("opt"), name: option.name, value: option.value }));
        pieces.push({ kind: "cmdline", id: line, name: step.name, options });
        show(line);
        (step.options ?? []).forEach((option, i) => {
          const field = options[i].id;
          wait(300);
          show(field);
          if (option.suggestions?.length) {
            const list = id("suggest");
            pieces.push({ kind: "suggest", id: list, option: option.name, values: option.suggestions, picked: option.value });
            show(list);
            actions.push({ a: "type", id: `${field}-value`, text: option.value.slice(0, Math.max(1, Math.ceil(option.value.length / 2))) });
            wait(600);
            actions.push({ a: "press", id: `${list}-pick` });
            wait(150);
            hide(list);
            actions.push({ a: "clear", id: `${field}-value` });
            actions.push({ a: "type", id: `${field}-value`, text: option.value });
          } else {
            actions.push({ a: "type", id: `${field}-value`, text: option.value });
          }
        });
        wait(450);
        hide(line);
        pending = `${user}|${step.name}`;
        break;
      }
      case "say": {
        const user = step.user ?? defaultUser;
        actions.push({ a: "type", id: "input", text: step.text });
        wait(350);
        actions.push({ a: "clear", id: "input" });
        const message = id("say");
        pieces.push({ kind: "user-message", id: message, author: user, text: step.text });
        show(message);
        wait(500);
        break;
      }
      case "reply": {
        const { do: _, ...reply } = step;
        const used = pending;
        pending = undefined;
        const target = id("msg");
        if (reply.thinking) {
          const thinking = id("think");
          pieces.push({ kind: "thinking", id: thinking, author: reply.author ?? bot, used });
          show(thinking);
          wait(reply.thinking);
          hide(thinking);
        }
        const piece: Extract<Piece, { kind: "message" }> = {
          kind: "message",
          id: target,
          user: false,
          author: reply.author ?? bot,
          used: reply.edit ? lastBot?.used : used,
          reply,
        };
        pieces.push(piece);
        if (reply.edit && lastBot) {
          // An edit: the new version takes the place of the old one.
          hide(lastBot.id);
          for (const piece of pieces) if (piece.kind === "chosen" && piece.of === lastBot.id) hide(piece.id);
        }
        show(target);
        lastBot = piece;
        wait(reply.edit ? 900 : 1100);
        break;
      }
      case "click": {
        if (!lastBot) break;
        wait(200);
        actions.push({ a: "press", id: `${lastBot.id}-btn-${step.button}` });
        wait(350);
        break;
      }
      case "choose": {
        if (!lastBot?.reply.select) break;
        const list = id("drop");
        const pickId = `${list}-pick`;
        pieces.push({ kind: "dropdown", id: list, of: lastBot.id, options: lastBot.reply.select.options, picked: step.option, pickId });
        const option = lastBot.reply.select.options.find((o) => o.label === step.option);
        const chosen = id("chosen");
        pieces.push({ kind: "chosen", id: chosen, of: lastBot.id, label: step.option, emoji: option?.emoji });
        actions.push({ a: "press", id: `${lastBot.id}-select` });
        show(list);
        wait(700);
        actions.push({ a: "press", id: pickId });
        wait(200);
        hide(list);
        show(chosen);
        wait(500);
        break;
      }
      case "modal": {
        const modal = id("modal");
        const fields = step.fields.map((field) => ({ ...field, id: id("field") }));
        pieces.push({ kind: "modal", id: modal, title: step.title, submit: step.submit, submitId: `${modal}-submit`, fields });
        show(modal);
        wait(450);
        for (const field of fields) {
          actions.push({ a: "type", id: `${field.id}-value`, text: field.value });
          wait(250);
        }
        actions.push({ a: "press", id: `${modal}-submit` });
        wait(200);
        hide(modal);
        // The answer to a form says who sent it, like a command.
        pending = undefined;
        break;
      }
      case "join": {
        const join = id("join");
        pieces.push({ kind: "join", id: join, user: step.user });
        show(join);
        wait(700);
        break;
      }
      case "wait":
        wait(step.ms);
        break;
    }
  }
  return { pieces, actions, final: shown, input: "" };
}

export { TYPE_GAP };
