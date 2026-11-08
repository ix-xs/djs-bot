// Data for the dev-only page src/pages/dev/[state].astro: the kind of scene
// the guide shows, the worst realistic one, and the smallest one. The worst
// case stays within Discord's own limits: a command name of 32 characters, a
// description of 100, a button label of 80, five buttons to a row, a display
// name of 32, an embed title of 256.
import type { Step } from "./plan";

type Fixture = { discord: Step[][]; terminal: { command: string; lines: { text: string; level?: "info" | "warn" | "error" | "ok" | "dim" | "fail"; at?: string }[] }[] };

export const demo: Fixture = {
  discord: [
    [
      { do: "command", name: "ping", description: "Check the bot is alive" },
      { do: "reply", embed: { color: "#22c55e", description: "Pong! 🏓 42 ms" } },
    ],
  ],
  terminal: [{ command: "npx djs-bot dev", lines: [{ at: "14:02:10", level: "info", text: "Ready user=my-bot#1234 guilds=1 version=1.4.1" }] }],
};

const user = "Aleksandra Wiśniewska-Kowalczyk";
const link = "https://discord.com/channels/123456789012345678/123456789012345678/1234567890123456789";

export const worst: Fixture = {
  discord: [
    [
      {
        do: "command",
        name: "configure-automod-rules-for-all",
        description: "Configure the automatic moderation rules for this server: filters, exemptions, alerts and logs.",
        options: [
          { name: "message-link", value: link },
          { name: "reason-for-the-moderation-log", value: "Repeated spam of invite links in #general after two warnings", suggestions: [link, "Repeated spam of invite links in #general after two warnings"] },
        ],
        user,
      },
      {
        do: "reply",
        author: "Moderation Assistant Pro Max",
        text: `Rule saved for ${link} by @Aleksandra.`,
        embed: {
          color: "#f59e0b",
          title: "Automatic moderation rule «Invite links in public channels» updated with 14 exemptions and 3 alert channels",
          description: `Messages matching \`(discord\\.gg|discord\\.com\\/invite)\\/[A-Za-z0-9-]+\` are deleted. Source: ${link}`,
          fields: [
            { name: "Exempt roles", value: "@Moderators, @[Senior Moderators], @[Community Managers], @[Partner Program]", inline: true },
            { name: "Alerts", value: "#mod-log-and-automod-alerts-for-the-team", inline: true },
            { name: "Created", value: "1 284 rules before this one", inline: true },
          ],
          footer: "Rule id 98f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e",
        },
        buttons: [
          { label: "Approve and notify the moderators", style: "success" },
          { label: "Reject with a reason", style: "danger" },
          { label: "Edit the rule", style: "primary" },
          { label: "Show every exemption", style: "secondary" },
          { label: "🗑️", style: "secondary" },
        ],
      },
      { do: "click", button: "Approve and notify the moderators", user },
      {
        do: "reply",
        text: "Which channel should receive the alerts?",
        select: {
          placeholder: "Pick a channel for the moderation alerts (you can change it later in /settings)",
          options: [
            { label: "#mod-log-and-automod-alerts-for-the-team", description: "The private channel of the moderation team, with the full history of every action" },
            { label: "#general" },
            { label: "#announcements", emoji: "📣" },
            { label: "#staff", description: "Staff only" },
            { label: "#bots", emoji: "🤖", description: "Where the bots talk" },
            { label: "#archive-2023", description: "Read-only" },
          ],
        },
      },
      { do: "choose", option: "#mod-log-and-automod-alerts-for-the-team" },
      { do: "reply", text: "Alerts go to #mod-log-and-automod-alerts-for-the-team.", edit: true },
    ],
    [
      { do: "join", user },
      { do: "say", text: `hey, is this the right place to report ${link} ?`, user },
      { do: "reply", text: "x", thinking: 1500, ephemeral: true },
    ],
    [
      { do: "command", name: "feedback", description: "Send feedback to the team", user },
      {
        do: "modal",
        title: "Send feedback to the moderation and community team (anonymous by default)",
        fields: [
          { label: "Subject of your feedback, in a few words", value: "Automod deletes links to our own documentation site" },
          { label: "Your feedback", value: `Since yesterday, every message with ${link} is deleted, even in #staff where the rule should not apply. Could you exempt our documentation domain?`, long: true },
        ],
      },
      { do: "reply", embed: { color: "#22c55e", description: "Thanks for \"Automod deletes links to our own documentation site\"." }, ephemeral: true },
    ],
  ],
  terminal: [
    {
      command: "npx djs-bot deploy --guild 123456789012345678 --dry-run",
      lines: [
        { text: "" },
        { text: "✓ guild 123456789012345678 (dry run)", level: "ok" },
        { text: "  + configure-automod-rules-for-all, moderation-history, report-message, user-info, warnings-list, appeal-ban, slowmode-channel", level: "ok" },
        { at: "14:21:08", level: "info", text: 'Commands deployed scope=guild guildId=123456789012345678 added=["configure-automod-rules-for-all","moderation-history","report-message"] changed=[] removed=["old-moderation-command-from-v1"]' },
        { level: "fail", text: `Error: Missing required environment variable "DISCORD_MODERATION_ALERTS_WEBHOOK_URL_FOR_THE_STAFF_SERVER". Add it to your environment or a .env file.` },
      ],
    },
  ],
};

export const one: Fixture = {
  discord: [
    [
      { do: "command", name: "a", description: "A" },
      { do: "reply", text: "1", buttons: [{ label: "1" }] },
    ],
  ],
  terminal: [{ command: "ls", lines: [] }],
};
