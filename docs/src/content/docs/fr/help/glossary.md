---
title: "Glossaire"
description: "Tous les termes de Discord et du framework que vous rencontrerez, expliqués simplement."
sidebar:
  order: 3
---

Si un mot de la documentation vous est inconnu, il est défini ici.

## Termes de Discord

**Application**
: Ce que vous créez dans le Developer Portal. Elle possède votre utilisateur bot,
  vos commandes et vos identifiants. Une application, un bot.

**Utilisateur bot**
: Le compte que les gens voient dans un serveur. Il appartient à une application
  et se connecte avec un **token**.

**Token**
: Le secret qui authentifie votre bot. Quiconque le détient contrôle votre bot :
  il vit donc dans `.env`, jamais dans git. Régénérez-le dans le Developer Portal
  s'il fuite.

**Identifiant client (identifiant d'application)**
: L'identifiant numérique public de votre application. Nécessaire pour déployer
  les commandes et construire les liens d'invitation. Ce n'est pas un secret.

**Guild**
: Ce que l'API de Discord appelle un **serveur**. La documentation emploie les
  deux mots pour la même chose, parce que l'API le fait.

**Snowflake**
: Un identifiant Discord : une longue chaîne numérique comme
  `123456789012345678`. Les utilisateurs, serveurs, salons, rôles et messages en
  ont tous un. Pour les obtenir, activez le mode développeur dans Discord et
  faites un clic droit sur n'importe quel élément.

**Intent**
: Un abonnement à une catégorie d'événements de la passerelle (*gateway*). Vous
  déclarez ce que vous voulez recevoir et Discord n'envoie que cela. Trois
  d'entre eux sont **privilégiés** et doivent être activés dans le Developer
  Portal : Server Members, Message Content, Presence.

**Passerelle (gateway)**
: La connexion WebSocket persistante par laquelle Discord pousse les événements.
  « Le bot est connecté » signifie que la passerelle est active.

**API REST**
: Le côté HTTP de Discord, utilisé pour envoyer des messages, bannir des membres
  et enregistrer des commandes. Le déploiement passe par là, pas par la
  passerelle.

**Interaction**
: Tout ce qu'un utilisateur fait et à quoi votre bot doit répondre : une commande
  slash, un clic sur un bouton, un choix dans un menu de sélection, l'envoi d'une
  modale, une frappe dans l'autocomplétion. Chaque interaction porte un
  **token** valable **3 secondes** pour l'acquitter, puis 15 minutes pour
  continuer à la modifier.

**Commande slash**
: Une commande qu'on appelle en tapant `/nom`. On parle aussi de commande
  d'application.

**Commande de menu contextuel**
: Une commande du menu **Applications** du clic droit, sur un utilisateur ou sur
  un message.

**Éphémère**
: Une réponse que seul l'utilisateur qui a lancé la commande peut voir. Personne
  d'autre dans le salon ne la voit.

**Différer**
: Dire à Discord « j'y travaille », ce qui arrête le compte à rebours de
  3 secondes et affiche un état de chargement. Le framework peut le faire à votre
  place : voir **différé automatique**.

**customId**
: La chaîne attachée à un bouton, un menu de sélection ou une modale. C'est le
  seul état que Discord vous renvoie, et il est limité à **100 caractères**.

**Composant**
: Un élément interactif d'un message : bouton, menu de sélection, ou élément
  d'affichage Components V2.

**Components V2**
: Un format de message plus récent, fait de composants d'affichage composables à
  la place des embeds. À activer message par message avec le drapeau
  `IsComponentsV2`.

**Modale**
: Un formulaire en fenêtre contextuelle avec jusqu'à 5 composants : champs de
  texte, listes déroulantes, sélecteurs, envois de fichiers, boutons radio, cases
  à cocher.

**Permission**
: Ce qu'un membre ou un bot a le droit de faire. Les rôles du serveur les
  accordent, et les **surcharges de salon** peuvent les accorder ou les refuser
  salon par salon. Les surcharges l'emportent.

**Sharding**
: Répartir la connexion à la passerelle sur plusieurs processus. Discord l'impose
  à **2500 serveurs**.

**Limite de débit (rate limit)**
: Discord plafonne la fréquence de vos appels à l'API. Si vous la dépassez, vous
  recevez des réponses 429.

## Termes du framework

**Définition**
: Un simple objet créé par une fonction `define*()` et marqué d'un `kind`. Les
  commandes, événements, boutons, services, tâches planifiées, plugins et
  features sont toutes des définitions.

**Feature**
: Un ensemble autonome de définitions, créé avec `defineFeature`. L'unité que
  vous publieriez ou copieriez d'un bot à l'autre.

**Source de features**
: Ce que vous passez à `defineBot({ features })` : un dossier à découvrir
  automatiquement, des définitions explicites, ou les deux.

**Chargeur (loader)**
: La partie qui parcourt votre dossier de features, lit les exports de chaque
  fichier et route chaque définition selon son `kind`. Importer un fichier
  n'enregistre jamais rien de lui-même.

**ctx**
: L'objet unique que reçoit chaque gestionnaire. Il porte l'interaction brute,
  l'utilisateur, le serveur, vos services, un journal et les aides de réponse.

**Garde (guard)**
: Une condition préalable exécutée avant un gestionnaire. Elle passe, ou elle
  échoue avec un message que l'utilisateur voit.

**Service**
: Un objet partagé, enregistré sous un token texte et injecté dans chaque
  `ctx.services`. Votre client de base de données, votre logique métier.

**Conteneur**
: Le registre d'injection de dépendances qui résout les services dans l'ordre
  topologique au démarrage, une seule fois chacun.

**Carte des services**
: L'interface TypeScript que vous augmentez pour que `ctx.services.db` soit typé
  plutôt que `unknown`.

**Plugin**
: Un comportement transversal enregistré via des hooks : journalisation, limite
  de débit, remontée d'erreurs, mode maintenance.

**Hook**
: Un point où un plugin s'attache : `beforeInteraction`, `afterInteraction`,
  `onError`, `onReady`, `onShutdown`.

**Middleware**
: Un hook `beforeInteraction` qui enveloppe le gestionnaire. Appelez `next()`
  pour continuer, ou ne l'appelez pas pour arrêter l'interaction.

**Contrat de capacités**
: `requires` et `provides` sur une feature ou un plugin, vérifiés au démarrage
  pour qu'une dépendance manquante échoue tout de suite plutôt qu'à la première
  interaction.

**Différé automatique**
: Laisser le framework acquitter un gestionnaire qui n'a pas répondu au bout de
  2 secondes, pour qu'il n'atteigne jamais la limite de 3 secondes de Discord.
  S'active avec `defer`.

**Pilote automatique des intents**
: Déduire l'ensemble minimal d'intents à partir des événements, déclencheurs et
  gardes que vous avez enregistrés. S'active avec `intents: "auto"`.

**Comparaison au déploiement**
: Comparer votre arbre de commandes local avec ce que Discord possède déjà, et
  n'envoyer que les ajouts, mises à jour et suppressions.

**Serveur de développement**
: Un serveur de test qui reflète toutes les commandes, pour que les changements
  apparaissent instantanément au lieu de se propager globalement pendant jusqu'à
  une heure.

**Mode d'introspection**
: La façon dont `deploy`, `clear`, `doctor` et `explain` importent votre fichier
  d'entrée : `DJSBOT_CLI=introspect` est défini et le bot ne se connecte jamais à
  la passerelle.

**Identifiant de corrélation**
: Un identifiant unique attaché à chaque ligne de journal d'une même interaction,
  pour suivre une requête de bout en bout.

**Barrière d'erreurs**
: Le filet de sécurité du framework autour des gestionnaires. Elle journalise,
  exécute votre `onError`, et répond à l'utilisateur plutôt que de laisser une
  exception bloquer l'interaction.

**Code d'erreur**
: Un identifiant stable `DJSBOT_Exxx` sur chaque erreur du framework, avec une
  piste de résolution et un lien vers la documentation. Voir
  [le catalogue](/api/errors/).

**Déclencheur (trigger)**
: Une réponse automatique aux messages, reconnue sur `messageCreate` par mot-clé,
  expression régulière ou prédicat.

**Tâche planifiée (job)**
: Une tâche programmée, définie avec une expression cron ou un intervalle.

**Store**
: L'abstraction clé-valeur asynchrone (`KVStore`) que parle le framework, au lieu
  d'imposer une base de données.

**Espace de noms (namespace)**
: Une vue préfixée d'un store, pour qu'une feature puisse lister et vider ses
  propres clés sans toucher à celles des autres.

**Feature flag**
: Un interrupteur activé ou désactivé à l'exécution, globalement ou par serveur,
  et conservé dans un store.

**Piste d'audit**
: Un enregistrement structuré de qui a fait quoi, écrit vers un ou plusieurs
  puits.

**Puits (sink)**
: Une destination pour les entrées d'audit : la mémoire, un store, le journal, ou
  la vôtre.

**Harnais**
: L'aide de test qui exécute un gestionnaire sans connexion à Discord et capture
  tout ce qu'il a envoyé.
