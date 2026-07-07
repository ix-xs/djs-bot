# @ix-xs/djs-bot

Small CommonJS toolkit for building Discord bots on top of `discord.js`, with a straightforward API for commands, interactions, Components v2 and common message payloads.

`@ix-xs/djs-bot` bundles:

- a high-level bot wrapper (`DJSBot`)
- builders for commands, interactions, polls, attachments, embeds, timestamps
- wrapper classes for Components v2 payloads (containers, sections, labels, inputs, selects, etc.).

`discord.js` is already included as a dependency of this package, you do not need to install it separately.

---

## Installation

```bash
npm install @ix-xs/djs-bot
```

---

## Requirements

- Node.js
- A Discord application with a bot token
- CommonJS project (using `require(...)`)

The package ships with TypeScript declaration files (`types/index.d.ts`) and targets `discord.js` v14.

---

## Getting started

A minimal bot usually needs:

1. Create the bot instance.
2. Register at least one command.
3. Reply to the command.
4. Register component / modal interactions.

The example below shows a small but realistic flow with a slash command, a select menu, buttons and a modal.

```js
const { DJSBot, SlashCommand, StringOption, Container, TextDisplay, ActionRow, SelectMenu, Button, Modal, Label, TextInput } = require("@ix-xs/djs-bot");

// bot instance
const bot = new DJSBot({
  id: process.env.DISCORD_CLIENT_ID,
  token: process.env.DISCORD_TOKEN,
  intents: "all", // or ["Guilds", "GuildMessages", ...]
  canMention: {
    everyone: false,
    onReply: true,
    users: true,
    roles: true,
  },
});

// slash command
bot.addCommand(
  new SlashCommand({
    name: "demo",
    description: "Small command showing a reply with components",
    contexts: ["guild", "bot_dm", "private_channel"],
    integration_types: ["guild_install", "user_install"],
    options: [
      new StringOption({
        name: "input",
        description: "Text to include in the response",
        required: false,
      }),
    ],
    handler: async (command) => {
      const input = command.options.getString("input") ?? "No input provided";

      const container = new Container({
        color: "Aqua",
        components: [
          new TextDisplay("# @ix-xs/djs-bot demo"),
          new TextDisplay(`Input received: **${input}**`),
          new TextDisplay("Use the select menu, open the modal, or click the confirm button."),
          new ActionRow([
            new SelectMenu({
              type: "string",
              custom_id: "demo:select",
              placeholder: "Choose an action",
              options: [
                { label: "Show info", value: "info" },
                { label: "Show help", value: "help" },
                { label: "Show status", value: "status" },
              ],
            }),
          ]),
          new ActionRow([
            new Button({
              style: "blue",
              custom_id: "demo:open-modal",
            }).setLabel("Open modal"),
            new Button({
              style: "gray",
              custom_id: "demo:confirm",
            }).setLabel("Confirm"),
          ]),
        ],
      });

      await command.reply({
        content: `Used : </${command.commandName}:${command.commandId}>`,
        components: [container.toJSON()],
      });
    },
  })
);

// select menu interaction
bot.addInteraction({
  custom_id: "demo:select",
  type: "selectmenu",
  handler: async (interaction) => {
    const value = interaction.values?.;

    const messages = {
      info: "You selected the info action.",
      help: "You selected the help action.",
      status: "You selected the status action.",
    };

    await interaction.reply({
      content: messages[value] ?? "Unknown selection.",
      ephemeral: true,
    });
  },
});

// button interaction
bot.addInteraction({
  custom_id: "demo:confirm",
  type: "button",
  handler: async (interaction) => {
    await interaction.reply({
      content: "Action confirmed.",
      ephemeral: true,
    });
  },
});

// modal opener
bot.addInteraction({
  custom_id: "demo:open-modal",
  type: "button",
  handler: async (interaction) => {
    const modal = new Modal({
      custom_id: "demo:feedback-modal",
      title: "Send feedback",
      components: [
        new Label({
          label: "Feedback",
          component: new TextInput({
            custom_id: "feedback",
            style: "Paragraph",
            min_length: 3,
            max_length: 500,
            placeholder: "Write a short message",
            required: true,
          }),
        }),
      ],
    });

    await interaction.showModal(modal.toJSON());
  },
});

// modal submit
bot.addInteraction({
  custom_id: "demo:feedback-modal",
  type: "modal",
  handler: async (interaction) => {
    const feedback = interaction.fields.getTextInputValue("feedback");

    await interaction.reply({
      content: `Feedback received: ${feedback}`,
      ephemeral: true,
    });
  },
});

// events
bot.on("clientReady", (client) => {
  console.log(`Bot ready as ${client.user.tag}`);
});

// start
bot.start();
```

---

## Exports overview

`@ix-xs/djs-bot` is split into three main parts:

- **Bot wrapper**
  - `DJSBot`

- **Build helpers** (from `builds/$`)
  - `Attachment`
  - `Embed`
  - `Interaction`
  - `MessageContextCommand`
  - `Poll`
  - `SlashCommand`
  - `Unixify`
  - `UserContextCommand`

- **Components** (from `components/$`)
  - `ActionRow`
  - `Button`
  - `Checkbox`
  - `CheckboxGroup`
  - `Container`
  - `File`
  - `FileUpload`
  - `Gallery`
  - `Label`
  - `Modal`
  - `Section`
  - `SelectMenu`
  - `Separator`
  - `TextDisplay`
  - `TextInput`
  - `Thumbnail`

All these classes validate inputs early, keep internal data private, and expose a small fluent API ending in `toJSON()` for raw payloads.

---

## DJSBot

High-level wrapper around a `discord.js` client, command registry, interaction registry, and optional filesystem auto‑loader.

### Constructor

```js
const bot = new DJSBot({
  token: process.env.DISCORD_TOKEN,
  id: process.env.DISCORD_CLIENT_ID,
  intents: "all" || ["Guilds", "GuildMessages", ...],
  canMention: {
    everyone: false,
    users: true,
    roles: true,
    onReply: true,
    usersList: ["123...", "456..."],
    rolesList: ["789...", "012..."],
  },
  events_folder: "./events",
  commands_folder: "./commands",
  interactions_folder: "./interactions",
});
```

#### Options

- `token`: bot token.
- `id`: application / client id.
- `intents`: `"all"` or a `discord.js` intents resolvable.
- `canMention`: configure allowed mentions.
  - `everyone`
  - `users`
  - `roles`
  - `onReply`
  - `usersList`
  - `rolesList`
- `events_folder`: folder with runtime event modules.
- `commands_folder`: folder with command definition modules.
- `interactions_folder`: folder with interaction definition modules.

Folders are optional. When omitted, commands and interactions can still be registered manually before calling `start()`.

### Methods

- `on(event, handler)`
  - Register a client event listener through the internal event bridge.
- `once(event, handler)`
  - Register a one‑time client event listener.
- `addCommand(command)`
  - Register a command instance (`SlashCommand`, `MessageContextCommand`, `UserContextCommand`).
- `addInteraction(interaction)`
  - Register an interaction instance (`Interaction`), including wildcard `custom_id` patterns such as `profile:*`.
- `start()`
  - Load commands, interactions and events (from folders if configured), register application commands through the REST API, then log in the client.
- `stop()`
  - Gracefully destroy the underlying Discord client.

---

## Commands & interactions (build helpers)

The `builds/$` entry point provides builder classes for commands and interactions.

### SlashCommand

Represents a slash command with metadata and a handler.

Typical fields:

- `command`: internal command payload (name, description, options, type).
- `guild_id`: optional guild id for guild‑scoped commands.
- `handler(interaction)`: main handler for chat input interactions.
- `autocomplete(interaction)`: optional handler for autocomplete interactions.

Commands are registered via `addCommand(...)` and then sent to Discord’s application commands endpoint when `start()` is called.

### MessageContextCommand

Message context menu command (right‑click on a message → “Apps”).

- registered via `addCommand(...)`
- handled inside `interactionCreate` when `interaction.isMessageContextMenuCommand()` is true.

### UserContextCommand

User context menu command (right‑click on a user → “Apps”).

- registered via `addCommand(...)`
- handled inside `interactionCreate` when `interaction.isUserContextMenuCommand()` is true.

### Interaction

Generic interaction wrapper used with `addInteraction(...)`:

- `type`: `"button"`, `"selectmenu"`, `"modal"`
- `custom_id`: custom id or wildcard pattern (e.g. `profile:*`)
- `handler(interaction)`: async function called on matching interaction

`DJSBot` dispatches button, select menu and modal interactions from `interactionCreate` to these handlers, including wildcard prefix matches.

### Poll

Wrapper around a Discord‑compatible poll payload:

- `question`: poll question text.
- `answers`: array of `{ text, emoji? }`.
- `duration`: poll duration in hours (1–720).
- `allowMultiselect`: allow multiple answers.

Methods (simplified):

- `setQuestion(...)`, `setAnswers(...)`, `addAnswer(...)`
- `setDuration(...)`, `setAllowMultiselect(...)`, `clearAnswers()`
- `toJSON()` returns raw poll payload ready to be used as `poll` in a reply.

Example:

```js
const { Poll } = require("@ix-xs/djs-bot");

const poll = new Poll({
  question: "Which language do you prefer?",
  answers: [
    { text: "JavaScript", emoji: "🟨" },
    { text: "TypeScript", emoji: "🟦" },
    { text: "Rust", emoji: "🦀" },
  ],
  duration: 24,
  allowMultiselect: false,
});

await interaction.reply({
  content: "Daily poll:",
  poll: poll.toJSON(),
});
```

### Attachment, Embed, Unixify

Helpers for common payloads:

- `Attachment`: attachment payloads (files).
- `Embed`: rich embeds (title, description, fields, footer, thumbnails, etc.).
- `Unixify`: utilities around Unix timestamps and Discord timestamp formatting (`<t:...>`).

---

## Components

Component classes live under `components/$`. They model Components v2 payloads and are meant to be composed and serialized via `toJSON()`.

### Layout & container

- `Container`
  - Top‑level container for Components v2 messages (color, sections, rows, etc.).
- `Section`
  - 1–3 `TextDisplay` entries plus an accessory (`Button` or `Thumbnail`).
- `ActionRow`
  - Row container for interactive components (buttons, selects…).
- `Separator`
  - Visual divider component.
- `Gallery`
  - Media gallery container.

### Display & media

- `TextDisplay`
  - Markdown text block, with length validation.
- `Thumbnail`
  - Thumbnail payload with `url`, optional `description`, and `spoiler` support (http(s) or `attachment://`).

### Inputs & selections

- `TextInput`
  - Modal text input with `Short` or `Paragraph` style and fields `min_length`, `max_length`, `required`, `placeholder`, `value`.
- `SelectMenu`
  - Wrapper around string, user, role, mentionable and channel select menus:
    - `type`: `"string" | "user" | "role" | "mentionable | "channel"`
    - `options` for string selects
    - `default_values` for user/role/channel selects
    - `channel_types` for channel selects
- `RadioGroup`
  - Single‑choice radio group, enforcing at most one default option.
- `Checkbox`, `CheckboxGroup`
  - Boolean and multi‑choice checkboxes.

### Labels & files

- `Label`
  - Label wrapping one child component, such as `TextInput`, `SelectMenu`, `FileUpload`, `RadioGroup`, `CheckboxGroup`, `Checkbox`.
- `File`, `FileUpload`
  - File selection / upload components.

### Buttons

- `Button`
  - Button component with style, label, `custom_id`, optional emoji, and fluent setters.

---

## Typical workflow

A practical workflow with `@ix-xs/djs-bot` usually looks like:

1. Create a `DJSBot` instance.
2. Configure `commands_folder`, `interactions_folder`, `events_folder`, or register everything manually.
3. Build commands using `SlashCommand`, `MessageContextCommand`, `UserContextCommand`.
4. Build reply content with components (`Container`, `Section`, `TextDisplay`, `Button`, `SelectMenu`, `Modal`, etc.).
5. Register button, select menu and modal handlers with `addInteraction(...)`.
6. Call `start()` to register commands via REST and connect the client.

This mirrors the standard Discord interaction lifecycle: receive a command, reply, then react to follow‑up interactions from the message or modal.

---

## Validation and payloads

Each class validates its own inputs and throws a `TypeError` early when something is invalid. Invalid payloads are caught before being sent to Discord.

Most wrappers:

- expose getters for their fields,
- expose fluent setters for updates,
- implement `toJSON()` to return a plain payload object ready to be used with `reply()`, `editReply()`, `followUp()` or REST calls.

---

## CommonJS and typings

`@ix-xs/djs-bot` is published for CommonJS projects and exposes bundled declaration files:

```json
{
  "type": "commonjs",
  "main": "index.js",
  "types": "types/index.d.ts"
}
```

JavaScript users work with `require(...)`, while TypeScript users can rely on the exported types from the package.

---

## Contributing

Issues and pull requests are welcome for:

- bugs and edge cases
- typing problems
- documentation fixes
- API inconsistencies

When adding new wrappers, keeping naming, validation rules and serialization behavior consistent with the existing classes is usually the right direction.

---

## Links

- Repository: [github.com/ix-xs/djs-bot](https://github.com/ix-xs/djs-bot)
- Issues: [github.com/ix-xs/djs-bot/issues](https://github.com/ix-xs/djs-bot/issues)
- `discord.js` documentation: [discord.js.org/docs](https://discord.js.org/docs)

---

## License

Add your license here if it has not been added to the package yet.
