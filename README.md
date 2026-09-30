# Budget foyer

Application web personnelle de suivi de budget mensuel pour un foyer à deux.

## Accès

- **Version stable V1** : https://nishiosxn.github.io/budget-app/
- **Snapshot V2.0** : https://nishiosxn.github.io/budget-app/v2/
- **Preview V2.1** : https://nishiosxn.github.io/budget-app/v2.1/
- **Preview V2.2** : https://nishiosxn.github.io/budget-app/v2.2/
- **Preview V2.3** : https://nishiosxn.github.io/budget-app/v2.3/

Le dépôt est public. Aucune donnée financière personnelle n'est inscrite dans le code. En V2.4, les opérations sont conservées dans un cache local puis synchronisées avec le foyer Supabase de l'utilisateur authentifié ; elles ne sont jamais envoyées sur GitHub.

## État actuel

- **Production** : V1
- **Développement actif** : V2.4
- **Branche active** : `v2.4`
- **PR V2.0 historique** : #1, fermée sans fusion et conservée comme jalon
- **PR V2.1** : #2, jalon précédent
- **V2.2** : jalon validé et figé
- **V2.3** : données personnelles hors du code actif + onboarding + migration V1/V2.x
- **PR V2.2 source** : #4, fermée comme jalon
- **PR V2.3 source** : #7, brouillon
- **Synchronisation multi-appareils** : implémentée sur la branche V2.4, en attente du test utilisateur Magic Link à deux comptes

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
  cloud-realtime.js
  app.js
supabase/migrations/
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
- Chaque preview publiée utilise une clé dédiée afin de ne pas modifier une autre version.

La V2.3 propose une migration non destructive depuis les versions locales V1/V2.x et les sauvegardes legacy V4. La V2.4 copie également un cache V2.3 détecté vers sa propre clé sans effacer la source.

## Méthode de travail GitHub

Le fichier **[workstate.md](workstate.md)** est la source de continuité du projet. Avant une nouvelle session de développement, il faut le lire avant de rescanner le dépôt.

Les versions déjà publiées ou utilisées comme jalons ne sont pas écrasées. Une évolution significative crée une nouvelle branche/version (`v2.1`, `v2.2`, etc.) et une nouvelle URL de preview. Les anciens snapshots restent disponibles.

Voir **[CHANGELOG.md](CHANGELOG.md)** pour l'historique des versions.


## Branches de travail

- `main` : version stable actuellement en production.
- `develop` : tronc de développement de la future V2.
- `v2.x` : branche de version créée depuis `develop`, puis fusionnée vers `develop` après validation.
- `gh-pages` : branche réservée à la publication GitHub Pages et aux anciennes previews.

Les Pull Requests vers `develop` et `main` passent par le contrôle GitHub Actions **App integrity**.


## V2.4 — Cloud partagé

La V2.4 conserve le modèle local V5 de V2.3 comme cache et introduit un backend Supabase pour :
- authentification par Magic Link ;
- foyer partagé entre plusieurs comptes ;
- catégories, budgets, transactions et récurrences synchronisés ;
- mises à jour Realtime ;
- migration contrôlée des données locales V5 vers le cloud ;
- fonctionnement dégradé local en cas de perte réseau.

La synchronisation envoie des snapshots cohérents, archive les suppressions et conserve les modifications locales qui surviennent pendant un envoi. La stratégie V2.4 est « dernier écrivain gagnant » ; la résolution fine des conflits est réservée à V2.5.

Configuration publique utilisée côté navigateur :
- Project URL : `https://bqbemjxwdctyovtlpxpm.supabase.co`
- Publishable key Supabase uniquement ; aucun secret serveur n’est stocké dans le dépôt.

Sécurité côté Supabase validée après implémentation :
- RLS actif sur les 7 tables ;
- policies RLS limitées aux membres/propriétaires du foyer ;
- aucun accès direct `anon` aux tables ;
- RPC de foyer et d'invitation inaccessibles à `anon` ;
- Realtime actif sur les 6 tables ;
- schéma `private` inaccessible à `anon` ;
- migrations V2.4 suivies dans `supabase/migrations/`.
