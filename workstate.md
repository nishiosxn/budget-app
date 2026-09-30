# Workstate — Budget foyer V2.5

> Source de vérité pour reprendre le développement sans rescanner le dépôt.

## État

- Dépôt : `nishiosxn/budget-app`
- Branche active : `v2.5`
- Tronc V2 : `develop`
- Production : `main` → V1
- Base de départ : merge V2.4.1 dans `develop` (`70f627a4ab93c066323c81993bb1613fbbd92906`)
- Preview cible : `https://nishiosxn.github.io/budget-app/v2.5/`
- Projet Supabase : `budget-foyer` (`bqbemjxwdctyovtlpxpm`, `eu-west-1`)
- Objectif V2.5 : synchronisation multi-appareils robuste, fusion automatique des changements indépendants et conflits explicites lorsque deux appareils modifient la même donnée.

## Socle conservé

- Schéma métier local V5.
- Auth email/mot de passe, confirmation email, récupération de mot de passe et Magic Link facultatif.
- Foyers indépendants avec invitation explicite du deuxième membre.
- RLS sur les tables publiques et administration sécurisée par rôle + Edge Function.
- Realtime Supabase, cache hors ligne et archivage logique des suppressions.
- UI responsive V2.4.1.
- SMTP personnalisé Brevo déjà opérationnel dans Supabase. Aucun secret SMTP n'est versionné.

## Synchronisation V2.5

Nouveau module : `js/cloud-sync-v25.js`.

### Baseline locale

Après chaque chargement cloud réussi, V2.5 mémorise pour le foyer actif une baseline technique :

- identifiant cloud de chaque ligne ;
- `updated_at` distant ;
- représentation métier normalisée de la ligne.

La baseline est stockée sous une clé dédiée V2.5 et n'est jamais incluse dans un export utilisateur.

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

## Cache V2.5

- Cache principal : `budget-foyer-v2.5`
- Cache par foyer : `budget-foyer-v2.5:household:<id>`
- Foyer actif : `budget-foyer-v2.5-active-household`
- Modifications en attente : `budget-foyer-v2.5-cloud-pending:<id>`
- Baseline de synchro : `budget-foyer-v2.5-sync-baseline:<id>`

La première ouverture copie de manière non destructive les caches V2.4/V2.4.1 disponibles. L'ancien indicateur de modifications hors ligne V2.4 est également repris.

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
9. Tester hors ligne → plusieurs modifications → reconnexion.
10. Tester deux onglets ouverts afin de vérifier l'absence de doublons.
11. Vérifier mobile / desktop et l'état Realtime.
12. Exécuter **App integrity** avant merge.

## Workflow Git

- Travailler uniquement sur `v2.5` jusqu'à validation utilisateur.
- Publier la preview dans `gh-pages/v2.5/` sans écraser V2.4 ou V2.4.1.
- Après validation : PR `v2.5` → `develop`.
- Ne pas fusionner directement dans `main`.
