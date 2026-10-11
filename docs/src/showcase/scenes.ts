// The scenes of the landing page's showcase: one kind of feature each, with
// the file that implements it and what the framework does when it runs.
//
// The code is not written here: each scene points at a real file of
// `./samples`, a small translated bot that the type tests compile against the
// package. What its Discord says comes from that bot's own messages
// (`./samples/locales.ts`), in English or in French.
import profile from "./samples/features/profile/profile.command.ts?raw";
import fruit from "./samples/features/fruit/fruit.command.ts?raw";
import ticket from "./samples/features/tickets/ticket.button.ts?raw";
import colour from "./samples/features/colours/colour.select.ts?raw";
import report from "./samples/features/report/report.modal.ts?raw";
import reportMessage from "./samples/features/moderation/report.message.ts?raw";
import welcome from "./samples/features/welcome/welcome.event.ts?raw";
import dailyStats from "./samples/features/stats/daily-stats.job.ts?raw";
import { resources } from "./samples/locales";

export type Lang = "en" | "fr";
type Words = Record<Lang, string>;

export interface Trace {
  /** The step of the scene at which this line appears. */
  at: number;
  /** What happened. May contain `<code>`. */
  text: Words;
  /** The lines of the file that made it happen, first and last. */
  lines: [number, number];
}

export interface Scene {
  id: "command" | "autocomplete" | "button" | "select" | "modal" | "context" | "event" | "job";
  label: Words;
  /** The file, as it sits in the project. */
  file: string;
  code: string;
  trace: Trace[];
}

export const SCENES: Scene[] = [
  {
    id: "command",
    label: { en: "Slash command", fr: "Commande slash" },
    file: "features/profile/profile.command.ts",
    code: profile,
    trace: [
      { at: 1, lines: [4, 5], text: { en: "File found at startup, the command registered with Discord under both its names", fr: "Fichier trouvé au démarrage, commande enregistrée auprès de Discord sous ses deux noms" } },
      { at: 2, lines: [8, 12], text: { en: "<code>ctx.options.user</code> arrives as a <code>User</code>, never <code>undefined</code>", fr: "<code>ctx.options.user</code> arrive sous forme de <code>User</code>, jamais <code>undefined</code>" } },
      { at: 2, lines: [14, 15], text: { en: "<code>ctx.t</code> answers in the language of whoever ran the command", fr: "<code>ctx.t</code> répond dans la langue de la personne qui a lancé la commande" } },
    ],
  },
  {
    id: "autocomplete",
    label: { en: "Autocomplete", fr: "Autocomplétion" },
    file: "features/fruit/fruit.command.ts",
    code: fruit,
    trace: [
      { at: 1, lines: [13, 15], text: { en: "Handler called on each keystroke with <code>ctx.value</code>", fr: "Gestionnaire appelé à chaque frappe avec <code>ctx.value</code>" } },
      { at: 1, lines: [14, 14], text: { en: "Each suggestion is named in the language of the person typing", fr: "Chaque suggestion est nommée dans la langue de la personne qui tape" } },
      { at: 2, lines: [19, 20], text: { en: "<code>ctx.options.name</code> is the value that was picked, a <code>string</code>", fr: "<code>ctx.options.name</code> est la valeur choisie, une <code>string</code>" } },
    ],
  },
  {
    id: "button",
    label: { en: "Button", fr: "Bouton" },
    file: "features/tickets/ticket.button.ts",
    code: ticket,
    trace: [
      { at: 1, lines: [22, 22], text: { en: "The label was translated when the button was built", fr: "Le libellé a été traduit au moment où le bouton a été construit" } },
      { at: 1, lines: [5, 5], text: { en: "customId decoded: <code>ticketId \"T-1042\"</code>, typed", fr: "customId décodé : <code>ticketId \"T-1042\"</code>, typé" } },
      { at: 1, lines: [9, 11], text: { en: "Owner check passed", fr: "Vérification du propriétaire réussie" } },
      { at: 1, lines: [12, 12], text: { en: "<code>ctx.update.disable()</code> greyed the button out", fr: "<code>ctx.update.disable()</code> a grisé le bouton" } },
    ],
  },
  {
    id: "select",
    label: { en: "Select menu", fr: "Menu de sélection" },
    file: "features/colours/colour.select.ts",
    code: colour,
    trace: [
      { at: 1, lines: [19, 25], text: { en: "Menu built where the message is sent, its options translated", fr: "Menu construit là où le message est envoyé, avec ses options traduites" } },
      { at: 2, lines: [4, 4], text: { en: "Choice routed to the menu by its id", fr: "Choix acheminé vers le menu grâce à son id" } },
      { at: 2, lines: [6, 10], text: { en: "<code>ctx.values</code> holds what was picked, the message is edited in place", fr: "<code>ctx.values</code> contient le choix, le message est modifié sur place" } },
    ],
  },
  {
    id: "modal",
    label: { en: "Form", fr: "Formulaire" },
    file: "features/report/report.modal.ts",
    code: report,
    trace: [
      { at: 1, lines: [24, 31], text: { en: "<code>ctx.showModal</code> opened the form, with its text in the reader's language", fr: "<code>ctx.showModal</code> a ouvert le formulaire, avec ses textes dans la langue du lecteur" } },
      { at: 1, lines: [6, 14], text: { en: "A menu, a paragraph and a checkbox, each declared once", fr: "Un menu, un paragraphe et une case à cocher, déclarés une seule fois" } },
      { at: 2, lines: [15, 16], text: { en: "<code>ctx.fields</code> typed from the declaration: <code>details</code> is a <code>string</code>", fr: "<code>ctx.fields</code> typé d'après la déclaration : <code>details</code> est une <code>string</code>" } },
    ],
  },
  {
    id: "context",
    label: { en: "Context menu", fr: "Menu contextuel" },
    file: "features/moderation/report.message.ts",
    code: reportMessage,
    trace: [
      { at: 1, lines: [4, 5], text: { en: "The command appears under Apps on every message, under its translated name", fr: "La commande apparaît sous Applications, sur chaque message, sous son nom traduit" } },
      { at: 2, lines: [7, 7], text: { en: "<code>ctx.targetMessage</code> is the message that was clicked", fr: "<code>ctx.targetMessage</code> est le message qui a été cliqué" } },
      { at: 2, lines: [8, 8], text: { en: "Ephemeral reply: only the reporter sees it", fr: "Réponse éphémère : seul l'auteur du signalement la voit" } },
    ],
  },
  {
    id: "event",
    label: { en: "Event", fr: "Événement" },
    file: "features/welcome/welcome.event.ts",
    code: welcome,
    trace: [
      { at: 1, lines: [4, 4], text: { en: "The <code>GuildMembers</code> intent is on because this listener exists", fr: "L'intent <code>GuildMembers</code> est activé parce que cet écouteur existe" } },
      { at: 1, lines: [5, 6], text: { en: "No user here, so no <code>ctx.t</code>: the language is the server's", fr: "Pas d'utilisateur ici, donc pas de <code>ctx.t</code> : la langue est celle du serveur" } },
      { at: 2, lines: [7, 7], text: { en: "Message sent to the system channel", fr: "Message envoyé dans le salon système" } },
    ],
  },
  {
    id: "job",
    label: { en: "Scheduled job", fr: "Tâche planifiée" },
    file: "features/stats/daily-stats.job.ts",
    code: dailyStats,
    trace: [
      { at: 1, lines: [5, 5], text: { en: "<code>@daily</code> fired at midnight, no cron line to write", fr: "<code>@daily</code> s'est déclenché à minuit, sans ligne cron à écrire" } },
      { at: 1, lines: [8, 8], text: { en: "<code>ctx.services.store</code> is the store of the bot, typed", fr: "<code>ctx.services.store</code> est le store du bot, typé" } },
      { at: 1, lines: [9, 9], text: { en: "A failure here is caught and logged, the bot keeps running", fr: "Une erreur ici est interceptée et journalisée, le bot continue de tourner" } },
    ],
  },
];

/** What the sample bot says, for a language: `say("fr", "profile.of", { user: "@Jo" })`. */
export function say(lang: Lang, key: string, vars: Record<string, string> = {}): string {
  let node: unknown = resources[lang];
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== "string") throw new Error(`The sample bot has no message "${key}" in "${lang}"`);
  return node.replace(/\{(\w+)\}/g, (whole, name: string) => vars[name] ?? whole);
}

/** The words of the site around the scenes, in the language of the page. */
export const WORDS = {
  kinds: { en: "Kinds of features", fr: "Types de fonctionnalités" },
  happened: { en: "What the framework did", fr: "Ce que le framework a fait" },
  idle: { en: "Play the scene to see what the framework does.", fr: "Jouez la scène pour voir ce que fait le framework." },
  step: { en: "Step {n}", fr: "Étape {n}" },
  replay: { en: "Replay", fr: "Rejouer" },
  client: { en: "Language of this Discord", fr: "Langue de ce Discord" },
  terminal: { en: "Terminal", fr: "Terminal" },
  join: { en: "A member joins", fr: "Un membre arrive" },
  midnight: { en: "Skip to midnight", fr: "Passer à minuit" },
} satisfies Record<string, Words>;

/** The words of the Discord app itself, which follow the language of its user. */
export const DISCORD = {
  channel: { en: "general", fr: "général" },
  composer: { en: "Message #general", fr: "Envoyer un message dans #général" },
  send: { en: "Send", fr: "Envoyer" },
  used: { en: "used", fr: "a utilisé" },
  today: { en: "Today at 14:02", fr: "Aujourd'hui à 14:02" },
  typing: { en: "djs-bot is thinking", fr: "djs-bot réfléchit" },
  onlyYou: { en: "Only you can see this", fr: "Toi seul peux voir celui-ci" },
  more: { en: "More", fr: "Plus" },
  reply: { en: "Reply", fr: "Répondre" },
  copy: { en: "Copy Text", fr: "Copier le texte" },
  apps: { en: "Apps", fr: "Applications" },
  cancel: { en: "Cancel", fr: "Annuler" },
  submit: { en: "Submit", fr: "Envoyer" },
  joined: { en: "joined the server.", fr: "a rejoint le serveur." },
} satisfies Record<string, Words>;
