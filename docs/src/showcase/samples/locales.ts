/**
 * The messages of the bot, in each language it speaks. `ctx.t("profile.of")`
 * reads them for the language of whoever is using the bot.
 */
export const resources = {
  en: {
    profile: { of: "Profile of {user}" },
    fruit: {
      apple: "apple",
      cherry: "cherry",
      mango: "mango",
      melon: "melon",
      picked: "You picked {fruit}",
    },
    ticket: {
      opened: "🎫 Ticket {id} is open",
      closed: "🔒 Ticket {id} is closed",
      close: "Close ticket",
      notYours: "Not your ticket.",
    },
    colour: {
      which: "Which colour?",
      pick: "Pick a colour",
      red: "Red",
      blue: "Blue",
      chosen: "You chose {colour}.",
    },
    report: {
      title: "Report a problem",
      kind: "Kind",
      details: "Details",
      urgent: "This is urgent",
      sent: "Reported as {kind}: {details}",
      done: "Reported to moderators.",
    },
    welcome: "Welcome {member}!",
  },
  fr: {
    profile: { of: "Profil de {user}" },
    fruit: {
      apple: "pomme",
      cherry: "cerise",
      mango: "mangue",
      melon: "melon",
      picked: "Tu as choisi : {fruit}",
    },
    ticket: {
      opened: "🎫 Le ticket {id} est ouvert",
      closed: "🔒 Le ticket {id} est fermé",
      close: "Fermer le ticket",
      notYours: "Ce n'est pas ton ticket.",
    },
    colour: {
      which: "Quelle couleur ?",
      pick: "Choisis une couleur",
      red: "Rouge",
      blue: "Bleu",
      chosen: "Tu as choisi {colour}.",
    },
    report: {
      title: "Signaler un problème",
      kind: "Type",
      details: "Détails",
      urgent: "C'est urgent",
      sent: "Signalé ({kind}) : {details}",
      done: "Signalé aux modérateurs.",
    },
    welcome: "Bienvenue {member} !",
  },
};
