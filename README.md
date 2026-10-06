# Budget foyer

Application web personnelle de suivi de budget mensuel pour un foyer à deux.

## Accès

- **Version stable V2.6** : https://nishiosxn.github.io/budget-app/
- **Snapshot V2.6** : https://nishiosxn.github.io/budget-app/v2.6/
- **Preview V2.7** : https://nishiosxn.github.io/budget-app/v2.7/
- **Snapshot V2.0** : https://nishiosxn.github.io/budget-app/v2/
- **Preview V2.1** : https://nishiosxn.github.io/budget-app/v2.1/
- **Preview V2.2** : https://nishiosxn.github.io/budget-app/v2.2/
- **Preview V2.3** : https://nishiosxn.github.io/budget-app/v2.3/
- **Preview V2.4** : https://nishiosxn.github.io/budget-app/v2.4/
- **Preview V2.4.1 UX/UI** : https://nishiosxn.github.io/budget-app/v2.4.1/
- **Preview V2.5 Sync** : https://nishiosxn.github.io/budget-app/v2.5/
- **Labo visuel V2.4-test** : https://nishiosxn.github.io/budget-app/v2.4-test/

Le dépôt est public. Aucune donnée financière personnelle n'est inscrite dans le code. En V2.4, les opérations sont conservées dans un cache local puis synchronisées avec le foyer Supabase de l'utilisateur authentifié ; elles ne sont jamais envoyées sur GitHub.

## État actuel

- **Production du code** : V2.6 sur `main`.
- Version du code : `V2.7`
- **Branche de développement de référence** : `develop`.
- **Version stable publiée** : V2.6 à la racine et snapshot sur `/v2.6/`.
- **État de release** : V2.6 reste la version stable ; V2.7 est en validation sur `work/v2.7-stabilization` avec preview `/v2.7/`.
- **Lot courant et prochaine action** : [workstate.md](workstate.md).
- **Historique** : [CHANGELOG.md](CHANGELOG.md).

## Fonctionnalités principales

La V1 permet de gérer les revenus, dépenses, épargne, catégories, budgets prévus, récurrences, historique, attribution Personne 1 / Personne 2 / à deux, export/import JSON et navigation mensuelle.

La V2 ajoute un onglet **Suivi** avec bilan annuel, comparaison mensuelle, reste cumulé, détail individuel et graphique réel / prévu.

La V2.1 fiabilise le suivi annuel. La V2.2 modularise le JavaScript. La V2.3 introduit un schéma local V5 autonome : aucun historique financier personnel n’est seedé dans le code actif, les noms du foyer sont locaux et un onboarding permet de créer un budget vide, migrer une ancienne version ou importer une sauvegarde.

## Architecture actuelle

```text
index.html
css/
  style.css
js/
  config.js
  data.js
  storage.js
  calculations.js
  ui.js
  categories.js
  transactions.js
  settings.js
  tracking.js
  onboarding.js
  supabase-config.js
  supabase-client.js
  auth.js
  cloud-household.js
  cloud-state-core.js
  cloud-load.js
  cloud-save.js
  cloud-sync-v25.js
  cloud-realtime.js
  app.js
supabase/migrations/
supabase/functions/admin-api/
admin/
README.md
workstate.md
CHANGELOG.md
```

La V2.2 a découpé l'ancien `js/app.js` monolithique en fichiers spécialisés sans modifier volontairement la logique métier. `app.js` ne contient plus que l'initialisation finale.

## Données locales

- V1 : `budget-foyer-v1`
- V2.3 source : `budget-foyer-v2.3`
- Preview V2.3 : `budget-foyer-v2.3-preview`
- V2.4 : `budget-foyer-v2.4`
- V2.5 : `budget-foyer-v2.5`
- Chaque preview publiée utilise une clé dédiée afin de ne pas modifier une autre version.

La V2.3 propose une migration non destructive depuis les versions locales V1/V2.x et les sauvegardes legacy V4. La V2.4 copie également un cache V2.3 détecté vers sa propre clé sans effacer la source.

## Méthode de travail GitHub

Lire **[AGENTS.md](AGENTS.md)** et **[workstate.md](workstate.md)** pour reprendre un lot, puis vérifier la branche réelle et les PR. La méthode complète se trouve dans **[docs/ASSISTANT_WORKFLOW.md](docs/ASSISTANT_WORKFLOW.md)**.

Chaque nouveau lot utilise une branche temporaire `work/vX.Y-<lot>` depuis `develop`, une Draft PR vers `develop`, des validations et un merge avant nettoyage de sa branche. Les tags Git identifient les jalons immuables après décision explicite. Les previews et snapshots restent sur `gh-pages`.

### Branches permanentes

- `main` : version stable de production.
- `develop` : tronc de développement.
- `gh-pages` : publication du site et archives de previews.
- `work/vX.Y-<lot>` ou `work/vX.Y.Z-<lot>` : branche temporaire d'un lot.

Les Pull Requests vers `develop` et `main` passent par **App integrity**. Depuis la racine : `node scripts/validate.mjs`. Les tests du contrôle documentaire sont aussi exécutés par la CI avec `node --test scripts/validate-docs.test.mjs`.

La promotion `develop` → `main` utilise une PR de release distincte. La publication à la racine de `gh-pages` est une opération séparée.

## V2.5 — Synchronisation robuste

La V2.5 conserve l'architecture cloud de V2.4/V2.4.1 mais remplace la stratégie « dernier écrivain gagnant » par une fusion optimiste basée sur une baseline locale et les `updated_at` Supabase.

L'identité Smart Budget validée est conservée dans `icons/icon.svg`. Les fichiers `favicon.ico`, `icon-192.png`, `icon-512.png` et `apple-touch-icon.png` du même dossier en sont les déclinaisons. Toute nouvelle version créée depuis `v2.5` doit reprendre le dossier `icons/`, les liens du document HTML, les entrées du manifest et le précache du service worker, puis incrémenter le nom de son cache PWA.

Principes :
- les changements locaux et distants sur des éléments différents sont conservés ;
- deux champs différents d'une même ligne peuvent être fusionnés automatiquement ;
- le même champ modifié différemment sur deux appareils crée un conflit explicite au lieu d'écraser une version ;
- une suppression concurrente à une modification déclenche aussi un conflit ;
- l'utilisateur choisit alors entre priorité locale et priorité cloud, sans perdre les changements non conflictuels ;
- les écritures sont protégées par une vérification optimiste de `updated_at` ;
- des index uniques sur `(household_id, legacy_id)` empêchent les doublons dus aux retries ou doubles onglets.

La V2.5 utilise un cache local séparé et reprend de manière non destructive les caches V2.4/V2.4.1.

## V2.4.1 — UX/UI responsive

La V2.4.1 conserve intégralement le socle métier, cloud et sécurité de la V2.4. Elle se concentre sur l'interface :
- typographie moins lourde et hiérarchie plus lisible ;
- textes secondaires renforcés en contraste et en poids ;
- tailles fluides avec `rem` et `clamp()` plutôt que des réductions fixes sur mobile ;
- espacements et cartes adaptatifs ;
- grilles renforcées avec `minmax(0,1fr)` ;
- comportement dédié aux écrans très étroits de type Fold ;
- zones interactives plus confortables ;
- prise en compte de `prefers-reduced-motion`.

La V2.4.1 réutilise volontairement le cache et le backend V2.4 : aucune migration de données ou modification Supabase n'est nécessaire pour cette évolution visuelle.

## V2.4 — Cloud partagé

La V2.4 conserve le modèle local V5 de V2.3 comme cache et introduit un backend Supabase pour :
- inscription et connexion par email/mot de passe, confirmation d'email et réinitialisation du mot de passe ;
- Magic Link comme méthode secondaire ;
- création automatique d'un foyer personnel vide pour chaque inscription normale ;
- foyer partagé uniquement au moyen d'une invitation explicite, expirante et stockée sous forme de hash ;
- catégories, budgets, transactions et récurrences synchronisés ;
- mises à jour Realtime ;
- migration contrôlée des données locales V5 vers le cloud ;
- fonctionnement dégradé local en cas de perte réseau ;
- interface `/admin/` protégée par un rôle en base et une Edge Function Supabase.

La synchronisation V2.4 envoie des snapshots cohérents et archive les suppressions. La résolution fine des conflits est implémentée à partir de V2.5.

Configuration publique utilisée côté navigateur :
- Project URL : `https://bqbemjxwdctyovtlpxpm.supabase.co`
- Publishable key Supabase uniquement ; aucun secret serveur n’est stocké dans le dépôt.

Sécurité côté Supabase validée après implémentation :
- RLS actif sur les 9 tables publiques ;
- policies RLS limitées aux membres/propriétaires du foyer ;
- aucun accès direct `anon` aux tables ;
- aucune mutation directe des membres par le navigateur ;
- RPC de provisionnement et d'invitation inaccessibles à `anon` et contrôlées côté base ;
- deux membres maximum par foyer, y compris au niveau du trigger SQL ;
- rôle global `app_admins` inaccessible aux clients et opérations privilégiées dans `admin-api` ;
- Realtime actif sur les 6 tables ;
- schéma `private` inaccessible à `anon` ;
- migrations V2.4 suivies dans `supabase/migrations/` ;
- aucune clé `service_role`, secret Supabase ou mot de passe de base dans le code navigateur.

Le compte propriétaire déjà présent au moment du déploiement a été désigné comme premier administrateur. Les administrateurs suivants doivent être ajoutés explicitement depuis le SQL Editor avec `select private.grant_app_admin_by_email('adresse@example.com');` ; cette fonction n'est pas exposée à l'API.

Les URLs de confirmation/récupération doivent être autorisées dans **Authentication → URL Configuration** pour `https://nishiosxn.github.io/budget-app/v2.4/**`. La protection contre les mots de passe compromis se règle dans **Authentication → Sign In / Password Security** ; ces réglages Auth hébergés ne sont pas modifiables par les migrations SQL.
