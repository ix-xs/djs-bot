// The scenes of the landing page's showcase: one kind of feature each, with
// the file that implements it and what the framework does when it runs.
//
// The code is not written here: each scene points at a real file of
// `./samples`, which the type tests compile against the package.
import profile from "./samples/profile.command.ts?raw";
import fruit from "./samples/fruit.command.ts?raw";
import ticket from "./samples/ticket.button.ts?raw";
import colour from "./samples/colour.select.ts?raw";
import report from "./samples/report.modal.ts?raw";
import reportMessage from "./samples/report.message.ts?raw";
import welcome from "./samples/welcome.event.ts?raw";
import dailyStats from "./samples/daily-stats.job.ts?raw";

type Words = { en: string; fr: string };

export interface Trace {
  /** The step of the scene at which this line appears. */
  at: number;
  /** What happened. May contain `<code>`. */
  text: Words;
  /** The lines of the file that made it happen, first and last. */
  lines?: [number, number];
}

export interface Scene {
  id: "command" | "autocomplete" | "button" | "select" | "modal" | "context" | "event" | "job";
  label: Words;
  /** The file, as it would sit in a project. */
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
      { at: 1, lines: [3, 5], text: { en: "File found at startup, <code>/profile</code> registered with Discord", fr: "Fichier trouvé au démarrage, <code>/profile</code> enregistrée auprès de Discord" } },
      { at: 2, lines: [7, 7], text: { en: "<code>ctx.options.user</code> arrives as a <code>User</code>, never <code>undefined</code>", fr: "<code>ctx.options.user</code> arrive sous forme de <code>User</code>, jamais <code>undefined</code>" } },
      { at: 2, lines: [9, 9], text: { en: "Reply sent as a green embed", fr: "Réponse envoyée dans un embed vert" } },
    ],
  },
  {
    id: "autocomplete",
    label: { en: "Autocomplete", fr: "Autocomplétion" },
    file: "features/fruit/fruit.command.ts",
    code: fruit,
    trace: [
      { at: 1, lines: [12, 13], text: { en: "Handler called on each keystroke with <code>ctx.value</code>", fr: "Gestionnaire appelé à chaque frappe avec <code>ctx.value</code>" } },
      { at: 1, lines: [12, 13], text: { en: "Suggestions made valid for Discord: 25 at most, 100 characters each", fr: "Suggestions rendues valides pour Discord : 25 au plus, 100 caractères chacune" } },
      { at: 2, lines: [16, 16], text: { en: "<code>ctx.options.name</code> is a <code>string</code>, the one that was picked", fr: "<code>ctx.options.name</code> est une <code>string</code>, celle qui a été choisie" } },
    ],
  },
  {
    id: "button",
    label: { en: "Button", fr: "Bouton" },
    file: "features/tickets/ticket.button.ts",
    code: ticket,
    trace: [
      { at: 1, lines: [4, 4], text: { en: "Click routed to this file by its id", fr: "Clic acheminé vers ce fichier grâce à son id" } },
      { at: 1, lines: [5, 5], text: { en: "customId decoded: <code>ticketId \"T-1042\"</code>, typed", fr: "customId décodé : <code>ticketId \"T-1042\"</code>, typé" } },
      { at: 1, lines: [10, 12], text: { en: "Owner check passed", fr: "Vérification du propriétaire réussie" } },
      { at: 1, lines: [13, 13], text: { en: "<code>ctx.update.disable()</code> greyed the button out", fr: "<code>ctx.update.disable()</code> a grisé le bouton" } },
    ],
  },
  {
    id: "select",
    label: { en: "Select menu", fr: "Menu de sélection" },
    file: "features/colours/colour.select.ts",
    code: colour,
    trace: [
      { at: 1, lines: [13, 19], text: { en: "Menu built where the message is sent, options included", fr: "Menu construit là où le message est envoyé, options comprises" } },
      { at: 2, lines: [4, 4], text: { en: "Choice routed to the menu by its id", fr: "Choix acheminé vers le menu grâce à son id" } },
      { at: 2, lines: [6, 6], text: { en: "<code>ctx.values</code> holds what was picked, the message is edited in place", fr: "<code>ctx.values</code> contient le choix, le message est modifié sur place" } },
    ],
  },
  {
    id: "modal",
    label: { en: "Form", fr: "Formulaire" },
    file: "features/report/report.modal.ts",
    code: report,
    trace: [
      { at: 1, lines: [21, 21], text: { en: "<code>ctx.showModal(Report)</code> opened the form", fr: "<code>ctx.showModal(Report)</code> a ouvert le formulaire" } },
      { at: 1, lines: [6, 14], text: { en: "A menu, a paragraph and a checkbox, each declared once", fr: "Un menu, un paragraphe et une case à cocher, déclarés une seule fois" } },
      { at: 2, lines: [15, 15], text: { en: "<code>ctx.fields</code> typed from the declaration: <code>details</code> is a <code>string</code>", fr: "<code>ctx.fields</code> typé d'après la déclaration : <code>details</code> est une <code>string</code>" } },
    ],
  },
  {
    id: "context",
    label: { en: "Context menu", fr: "Menu contextuel" },
    file: "features/moderation/report.message.ts",
    code: reportMessage,
    trace: [
      { at: 1, lines: [4, 4], text: { en: "The command appears under Apps on every message", fr: "La commande apparaît sous Applications, sur chaque message" } },
      { at: 2, lines: [6, 6], text: { en: "<code>ctx.targetMessage</code> is the message that was clicked", fr: "<code>ctx.targetMessage</code> est le message qui a été cliqué" } },
      { at: 2, lines: [7, 9], text: { en: "Ephemeral reply: only the reporter sees it", fr: "Réponse éphémère : seul l'auteur du signalement la voit" } },
    ],
  },
  {
    id: "event",
    label: { en: "Event", fr: "Événement" },
    file: "features/welcome/welcome.event.ts",
    code: welcome,
    trace: [
      { at: 1, lines: [3, 3], text: { en: "The <code>GuildMembers</code> intent is on because this listener exists", fr: "L'intent <code>GuildMembers</code> est activé parce que cet écouteur existe" } },
      { at: 1, lines: [3, 3], text: { en: "<code>member</code> is a <code>GuildMember</code>, from the event's name", fr: "<code>member</code> est un <code>GuildMember</code>, d'après le nom de l'événement" } },
      { at: 2, lines: [4, 4], text: { en: "Message sent to the system channel", fr: "Message envoyé dans le salon système" } },
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

/** The words of the showcase itself, around the scenes. */
export const WORDS = {
  kinds: { en: "Kinds of features", fr: "Types de fonctionnalités" },
  happened: { en: "What the framework did", fr: "Ce que le framework a fait" },
  idle: { en: "Play the scene on the right to see it.", fr: "Jouez la scène à droite pour le voir." },
  replay: { en: "Replay", fr: "Rejouer" },
  channel: { en: "general", fr: "général" },
  composer: { en: "Message #general", fr: "Envoyer un message dans #général" },
  send: { en: "Send", fr: "Envoyer" },
  used: { en: "used", fr: "a utilisé" },
  today: { en: "Today at 14:02", fr: "Aujourd'hui à 14:02" },
  typing: { en: "djs-bot is thinking", fr: "djs-bot réfléchit" },
  onlyYou: { en: "Only you can see this", fr: "Toi seul peux voir celui-ci" },
  more: { en: "More actions on this message", fr: "Plus d'actions sur ce message" },
  reply: { en: "Reply", fr: "Répondre" },
  copy: { en: "Copy Text", fr: "Copier le texte" },
  apps: { en: "Apps", fr: "Applications" },
  cancel: { en: "Cancel", fr: "Annuler" },
  submit: { en: "Submit", fr: "Envoyer" },
  join: { en: "A member joins", fr: "Un membre arrive" },
  joined: { en: "joined the server.", fr: "a rejoint le serveur." },
  midnight: { en: "Skip to midnight", fr: "Passer à minuit" },
  terminal: { en: "Terminal", fr: "Terminal" },
  online: { en: "bot online", fr: "bot online" },
} satisfies Record<string, Words>;
