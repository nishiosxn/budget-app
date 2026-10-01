# Workstate — Budget foyer V2.5.1

> Source de vérité pour reprendre le développement sans rescanner le dépôt.

## État

- Dépôt : `nishiosxn/budget-app`
- Branche active : `v2.5.1`
- Tronc V2 : `develop`
- Production : `main` → V1
- Base de départ : merge V2.4.1 dans `develop` (`70f627a4ab93c066323c81993bb1613fbbd92906`)
- Preview cible : `https://nishiosxn.github.io/budget-app/v2.5.1/`
- Projet Supabase : `budget-foyer` (`bqbemjxwdctyovtlpxpm`, `eu-west-1`)
- Objectif V2.5.1 : améliorer l’interface et passer à une synchronisation cloud continue, sans mode hors ligne ni cache financier persistant.

## Socle conservé

- Schéma métier local V5.
- Auth email/mot de passe, confirmation email, récupération de mot de passe et Magic Link facultatif.
- Foyers indépendants avec invitation explicite du deuxième membre.
- RLS sur les tables publiques et administration sécurisée par rôle + Edge Function.
- Realtime Supabase et archivage logique des suppressions ; les données financières actives viennent uniquement du cloud.
- UI responsive V2.4.1.
- SMTP personnalisé Brevo déjà opérationnel dans Supabase. Aucun secret SMTP n'est versionné.

## Interface V2.5.1

- Desktop ligne 1 : identité du foyer à gauche, état de synchronisation et Paramètres à droite.
- Desktop ligne 2 : navigation principale à gauche, mois + boutons Rentrée d'argent / Dépense à droite.
- Mobile ligne 1 : logo + nom du foyer à gauche, synchronisation + Paramètres à droite.
- Mobile ligne 2 : sélecteur de mois pleine largeur.
- Mobile ligne 3 : navigation ; quatre colonnes sur mobile large, grille 2×2 sur écran étroit.
- Sur les iPhone très étroits, le badge de synchronisation se réduit à son voyant pour préserver le nom du foyer.
- Les boutons de création restent dans la barre d'actions fixe en bas sur mobile.
- Aucun changement de schéma Supabase ou de règles RLS ; le moteur de synchronisation a été simplifié en mode cloud-only.

## Synchronisation V2.5.1

Nouveau module : `js/cloud-sync-v25.js`.

### Baseline de session

Après chaque chargement cloud réussi, V2.5.1 mémorise pour le foyer actif une baseline technique uniquement en mémoire :

- identifiant cloud de chaque ligne ;
- `updated_at` distant ;
- représentation métier normalisée de la ligne.

La baseline n’est plus enregistrée dans `localStorage`. Elle disparaît à la fermeture/recharge et est reconstruite depuis Supabase à l’ouverture.

### Fusion à trois versions

Pour chaque foyer, catégorie, budget, transaction et récurrence :

1. V2.5 compare la baseline ;
2. la version locale actuelle ;
3. la version distante actuelle.

Comportement :

- modification locale uniquement → envoyée au cloud ;
- modification distante uniquement → conservée et rechargée ;
- modifications locales et distantes sur des champs différents → fusion automatique ;
- même champ modifié différemment → conflit explicite ;
- suppression d'un côté + modification de l'autre → conflit explicite ;
- même résultat des deux côtés → aucun conflit.

### Résolution d'un conflit

Une carte apparaît dans **Paramètres & données** avec deux choix :

- **Garder mes modifications** : priorité locale uniquement sur les champs réellement en conflit ;
- **Garder la version cloud** : priorité distante uniquement sur les champs réellement en conflit.

Les modifications locales et distantes non conflictuelles restent fusionnées dans les deux cas.

### Protection contre les courses

Les mises à jour utilisent `updated_at` comme garde optimiste. Si la ligne change entre la lecture et l'écriture, l'opération est arrêtée et transformée en conflit au lieu d'écraser silencieusement les données.

### Déduplication

Migration appliquée :

`20260930104500_v2_5_sync_deduplication.sql`

Index uniques ajoutés sur `(household_id, legacy_id)` pour :

- `categories`
- `transactions`
- `recurrences`

But : empêcher les doublons lors de retries, doubles onglets ou écritures concurrentes portant le même identifiant local.

## Installation PWA

- Manifest `manifest.webmanifest` avec affichage `standalone`.
- Logo Smart Budget validé dans `icons/icon.svg` : carré vert `#285F49` et symbole crème `#F4F5F1`, sans police.
- Déclinaisons communes : `favicon.ico` (16/32/48 px), `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180 px).
- L'en-tête, l'onboarding, le panneau d'installation PWA et la page admin utilisent le même logo.
- Pour toute version créée depuis `v2.5`, conserver les cinq fichiers de `icons/` ainsi que les liens HTML et le manifest.
- Balises iOS pour l'ajout à l'écran d'accueil et l'ouverture sans interface Safari.
- Service worker `sw.js` conservé pour l’installation PWA uniquement ; aucun `fetch` n’est servi depuis un cache hors ligne.
- Module `js/pwa.js` : proposition d'installation uniquement sur mobile, après accès à l'application.
- Sur iPhone/iPad, le panneau explique « Partager → Sur l'écran d'accueil → Ajouter ».
- Sur Android, le bouton d'installation natif est utilisé lorsqu'il est disponible.
- Le panneau n'apparaît jamais en mode standalone et un refus est mémorisé pendant 7 jours.

## Mode cloud-only V2.5.1

- `state` reste uniquement en mémoire pendant la session du navigateur.
- `saveState()` déclenche la synchronisation cloud mais n’écrit plus les données financières dans `localStorage`.
- Les anciens caches V2.5 ne sont plus lus et sont supprimés après un chargement Supabase réussi.
- Le foyer actif peut rester mémorisé localement comme préférence de navigation ; les données du budget ne le sont pas.
- Les anciennes versions locales V2.4/V2.3 restent disponibles uniquement pour une migration volontaire.
- Si une synchronisation échoue, un bouton de relance apparaît à côté de l’état cloud et renvoie l’état complet de la session vers Supabase.
- À la reconnexion, une session modifiée tente aussi automatiquement de se resynchroniser.
- Le service worker ne fournit plus de fallback hors ligne.

## Fichiers principaux modifiés

```text
index.html
css/style.css
js/
  config.js
  storage.js
  auth.js
  cloud-household.js
  cloud-load.js
  cloud-save.js
  cloud-sync-v25.js
  cloud-realtime.js
scripts/validate.mjs
supabase/migrations/20260930104500_v2_5_sync_deduplication.sql
```

## À valider avant PR vers develop

1. Ajouter `https://nishiosxn.github.io/budget-app/v2.5/**` dans **Supabase → Authentication → URL Configuration**.
2. Connexion avec un compte existant et chargement du foyer.
3. Création / modification / suppression d'une transaction sur un appareil.
4. Modification d'une autre transaction depuis un second appareil : les deux changements doivent être conservés.
5. Modifier deux champs différents de la même transaction sur deux appareils : fusion automatique attendue.
6. Modifier le même champ de la même transaction différemment sur deux appareils : carte de conflit attendue.
7. Tester **Garder mes modifications**.
8. Reproduire un conflit puis tester **Garder la version cloud**.
9. Couper la connexion : vérifier qu’aucun cache hors ligne n’est utilisé, puis rétablir la connexion et tester la relance manuelle.
10. Tester deux onglets ouverts afin de vérifier l'absence de doublons.
11. Vérifier mobile / desktop et l'état Realtime.
12. Exécuter **App integrity** avant merge.

## Workflow Git

- Travailler uniquement sur `v2.5.1` jusqu'à validation utilisateur.
- Publier la preview dans `gh-pages/v2.5.1/` sans écraser les previews précédentes.
- Après validation : PR `v2.5.1` → `develop`.
- Ne pas fusionner directement dans `main`.
