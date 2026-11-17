# Workstate — Budget foyer

## Correctif V3.0.2 — formulaires tactiles

- Source : PR #45 fusionnée dans `develop` (`463ae1b4beafbf96fc47d4fc16972dd434a181ea`).
- Release depuis `main` : `work/v3.0.2-touch-input-release`. Correctif global des tailles de champs editables sur mobile/tablette sans bloquer le zoom manuel.
- Tests : `App integrity` sur la PR de développement et PR distincte de production ; seuls `index.html` et `css/touch-inputs.css` doivent être publiés à la racine Pages.
- Aucun changement dans les calculs, le backend ou les sauvegardes ; les snapshots restent inchangés.


## Correctif V3.0 — focus recherche Historique iOS

- Développement : `work/v3.0.1-history-ios-focus`, PR [#43](https://github.com/nishiosxn/budget-app/pull/43) fusionnée dans `develop` (`c300ff06d06f044513a8fb37698eb94659a8afe3`).
- Release : branche `work/v3.0.1-history-ios-release` issue de `main`, PR de release distincte vers `main` après App integrity, puis publication des fichiers CSS et HTML uniquement à la racine Pages.
- Correctif : champ `#historySearch` à 16 px sur les petits écrans pour prévenir le zoom automatique Safari, sans bloquer le zoom manuel ; aucune donnée financière ni schéma Supabase modifié.
- La préversion `/v3.0/`, le snapshot `/v2.8.1/` et les autres dossiers Pages demeurent inchangés.


## Publication — V3.0 Motion / UX

- Branche source : `work/v3.0-motion-ux` issue de `develop` (socle V2.9).
- PR d’intégration : [#40](https://github.com/nishiosxn/budget-app/pull/40), vers `develop`.
- Fonctionnalités : logo animé à progression fluide, écran de chargement unique, skeletons, transitions, compteurs, courbes interactives, meilleure lecture des abonnements. Les trois cartes supplémentaires d’accueil ont été retirées après retour utilisateur.
- Préversion validée par l’utilisateur le **17 novembre 2026** : https://nishiosxn.github.io/budget-app/v3.0/
- Dernier contrôle automatique avant la demande de publication : **App integrity réussi** sur `df65d2a61311991f2667ae2902618ff770ffe51b`, run [43981314800](https://github.com/nishiosxn/budget-app/actions/runs/43981314800).
- Authentification, écritures financières, synchronisation, RLS, migrations et sauvegardes Supabase inchangées par le lot V3.0.
- Livraison : PR #40 fusionnée dans `develop` ; promotion par PR de release distincte vers `main` avec CI **App integrity**, publication de la racine `gh-pages` et archivage de l'ancienne production V2.8.1 sous `/v2.8.1/`. Les préversions `/v2.9/` et `/v3.0/` restent intactes.
- Le déploiement de la préversion ne remplace pas des tests manuels de reprise d’une base ; aucune restauration de production n’est requise ici.

## État

- Dépôt : `nishiosxn/budget-app`
- Version du code : `V3.0`
- Branche de développement de référence : `develop`
- Production du code : `main` → V3.0.
- Publication : `gh-pages`.
- Version V2.6 publiée : https://nishiosxn.github.io/budget-app/v2.6/
- V3.0 publiée à la racine de GitHub Pages ; V2.8.1 conservée sous `/v2.8.1/`, préversions `/v2.9/` et `/v3.0/` conservées.
- Pour l'état exact de la branche temporaire, des PR et des checks, consulter GitHub plutôt que considérer ce fichier comme un journal de branches.

## Socle V2.5.1 à préserver

- Synchronisation cloud directe Supabase ; aucun cache financier persistant utilisé comme mode de travail.
- Baseline de session uniquement en mémoire.
- Fusion optimiste locale/cloud et conflits explicites sur les mêmes champs.
- Protection par `updated_at` et déduplication via les index `(household_id, legacy_id)`.
- Realtime, relance manuelle de synchronisation, authentification, invitations, RLS et administration existantes.
- PWA installable sans fallback financier hors ligne.
- Logo/icônes Smart Budget et interface V2.5.1 conservés.
- Les migrations V2.4/V2.5 déjà versionnées et appliquées restent inchangées.

## Workflow

Les branches permanentes sont `main`, `develop` et `gh-pages`. Les nouveaux lots partent de `develop` sur une branche temporaire `work/vX.Y-<lot>` ou `work/vX.Y.Z-<lot>`, avec Draft PR, **App integrity**, validation puis nettoyage après merge. Les versions validées sont conservées par tags immuables plutôt que par branches permanentes.

La branche historique `v2.5.1` sert de source à ce lot de migration. Après intégration validée et création du tag `v2.5.1`, elle pourra être supprimée avec les autres branches historiques.

## Lot précédent — V2.7 Stabilisation

- Branche : `work/v2.7-stabilization`
- Base : `develop`
- Objectif : stabiliser la V2.6 publiée avant promotion V2.7 : restauration des catégories, création d’épargne, sauvegarde/reset complets, picker couleur Paramètres, unités relatives, batching cloud sûr et alignement Git/Supabase.
- Critères d’acceptation :
  - montant réel directement cliquable ;
  - détail dépliable des opérations de chaque catégorie avec libellé, date, montant et payeur individuel ;
  - montant prévu directement cliquable ;
  - action individuelle « réel = prévu » en un clic quand elle est pertinente ;
  - actions secondaires regroupées derrière un menu `⋯` ;
  - suppression toujours confirmée ;
  - « Tout remplir » remplacé par un comportement sûr qui ne remplace pas un réel déjà saisi ;
  - « Tout vider » retiré du premier niveau visuel ;
  - lisibilité desktop/mobile améliorée, avec zones tactiles confortables ;
  - synchronisation et historique des ajustements inchangés ;
  - « Reste disponible ce mois » reste basé sur les montants réels du foyer ;
  - Répartition du mois affiche un solde personnel calculé à partir d’un solde d’ouverture mensuel et de l’attribution unique Baptiste / Anaëlle / À deux ;
  - solde d’ouverture éditable par personne sans être compté dans les revenus ;
  - aucune seconde notion de « compte débité/crédité » ;
  - dépenses « À deux » réparties 50/50 ; Baptiste ou Anaëlle = 100 % pour la personne choisie ;
  - épargne principale affichée sur le mois, avec cumul en secondaire.
- Exclusions : Historique et Suivi restent fonctionnellement inchangés ; les formules de budget prévues/réelles restent inchangées. Une table Supabase dédiée aux soldes d’ouverture a été ajoutée avec RLS par foyer.
- Validation prévue : `node --test scripts/validate-docs.test.mjs`, `node scripts/validate.mjs`, **App integrity**, puis validation visuelle utilisateur avant sortie du Draft.
- État : implémentation terminée sur la branche.
- Validation automatique : **App integrity** réussi sur le commit applicatif `c1a6f9fa4c39316ce337bdc17c8cbdf9d8886917`.
- Migration Supabase `v2_6_account_opening_balances` appliquée, ainsi que son ajout à la publication Realtime.
- Donnée initiale : solde d’ouverture Baptiste pour septembre 2026 = **108,18 €** ; Anaëlle reste non renseignée.
- Septembre Baptiste reconstruit depuis le relevé Boursobank en opérations détaillées : **1 073,64 € attribués en revenus**, **1 051,63 € attribués en dépenses**, solde final vérifié **130,19 €**.
- Catégorie `Aldi` archivée ; l’opération Aldi de 7,96 € est rangée dans `Courses` avec son libellé. Catégorie `Dons` créée pour Fondation de France.
- `Courses` : attribution **Baptiste** uniquement en septembre 2026, puis retour **À deux** à partir d’octobre.
- Erreur 403 Supabase sur les mises à jour de catégories corrigée : le moteur de synchronisation ne tente plus de réécrire la colonne `categories.type` lors d’une modification normale.
- Carte verte « Reste disponible ce mois » simplifiée : total foyer à gauche, reste réel Baptiste/Anaëlle à droite sur desktop et empilé proprement sur mobile.
- Catégories : petite flèche sur les catégories ayant des mouvements ; ouverture d’une liste locale des opérations du mois. Le payeur est lu sur chaque transaction, pas sur le total de la catégorie.
- Vérification live : l’opération Courses de **6,52 €** du 5 octobre est bien enregistrée individuellement avec Baptiste comme payeur.
- Validation utilisateur : autorisation explicite de publier V2.6 reçue après validation de la preview.
- Preview : https://nishiosxn.github.io/budget-app/previews/pr-23/
- Source applicative publiée : `3ed291c8912c601092d87cab8f6a0900378ba3f3`.
- Commit `gh-pages` de la preview : `d685e7b394a99f928828713edc3ce86d32b23227`.

## Lot courant — V2.8 Mobile UX

- Branche : `work/v2.8-mobile-ux`, issue de `develop`.
- PR brouillon : https://github.com/nishiosxn/budget-app/pull/30
- Périmètre : navbar tactile à cinq emplacements, bouton + flottant, ajout dépense/revenu via la modale existante, panneau de saisie mobile, date d'opération modifiable dans le mois choisi, accueil mobile réordonné, restauration du zoom natif.
- Exclusions : calculs financiers, données Supabase, migrations et publication en production.
- Vérification : `node scripts/validate.mjs`, check **App integrity**, tests visuels iPhone/Android/desktop et saisie d'une transaction de test sur un foyer non personnel.
- État : implémentation sur la branche ; **App integrity** réussi pour le SHA source `3aa0b465f0feee7c85529ecf03b458d4fe40ae09`.
- Preview publiée dans la branche `gh-pages` : https://nishiosxn.github.io/budget-app/v2.8/
- Commit de publication `gh-pages` : `5d14a322ee0c462db9d6d9b8bb0da799b110db61` ; copie de 38 fichiers applicatifs sans toucher à la racine ni aux snapshots.
- Les tests manuels responsive, le chargement public de la preview et les parcours authentifiés restent à valider.
- Important : la preview utilise le **Supabase de production** ; essais de saisie uniquement sur un foyer de test.

## Lot courant — V2.9 Historique et sécurité

- Branche : `work/v2.9-history-safety` depuis `develop` après fusion de la PR #30.
- Production actuelle : V2.8.1 ; le correctif de synchronisation de l'ordre des catégories a été fusionné (PR #35) et publié dans la racine et les previews actives.
- Incident du 16 novembre : les sauvegardes privées `incident_backup_20261116`, la restauration ciblée et les 6 protections d'écriture Supabase restent inchangées. Le client utilise `x-smart-budget-sync-version: 20261116-hf1`.
- Inclus : historique filtrable et triable, déplacement des opérations ponctuelles, et nouveau tableau d'abonnements et de récurrences en lecture seule dans l'onglet Catégories. Les boutons Modifier/Arrêter ouvrent les modales existantes.
- Exclu de ce lot : nouvelles migrations Supabase, import bancaire, réécriture de la synchronisation, synchronisation offline, sauvegardes automatiques par serveur.
- Tests : App integrity, tests des synthèses d'abonnements (budgets vs mouvements récurrents, actions non destructives), accessibilité et responsive. Préversion mise à jour sur `/v2.9/` avant validation utilisateur.

## Sauvegardes privées V2.9 — lot serveur

- Branche : `work/v2.9-private-backups` depuis `develop`, après fusion de la PR #34 (historique et abonnements).
- Trois migrations SQL enregistrées côté Supabase, fichiers sources alignés sur les versions réelles de migration : `20261116025347`, `20261116025548`, `20261116025626`.
- Schéma privé `smart_budget_backups`, avec contrôle du rôle `postgres` et droits `anon`, `authenticated`, `service_role` refusés ; RLS activée sans politique d'accès client.
- Instantanés des 8 tables, copie cohérente en une lecture MVCC, données archivées incluses. Rétention de 30 jours seulement pour les instantanés planifiés.
- Supabase Cron : tâche `smart-budget-financial-snapshot-every-6h`, horaire `17 */6 * * *` (UTC), active.
- Tests manuels réussis : snapshot #1 (`manual`) et #2 (`scheduled`) complets, 1 060 lignes dans 8 tables, aucune différence détectée avec l'état actuel. Les six garde-fous précédents restent activés.
- La récupération reste manuelle, en transaction contrôlée ; pas de fonction de restauration accessible à l'application. Les snapshots sont dans la même base et ne remplacent pas des sauvegardes externes.
- Runbook : [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md).

## Exports chiffrés GitHub Actions — configuration en attente

- Branche de production `main` : PR #38 fusionnée, workflow `offsite-backup.yml` installé sans toucher à l'application V2.8.1.
- Backport infrastructure V2.9 : ce lot recopie le workflow, le guide Windows et les tests vers `develop`.
- Cron GitHub quotidien à 03:43 UTC, export PostgreSQL 17 de `public`, `smart_budget_backups`, `incident_backup_20261116` directement dans `age`, fichier `.dump.age` conservé 60 jours en artefact.
- La tâche n'exporte rien avant configuration par le propriétaire : `SMART_BUDGET_BACKUP_AGE_RECIPIENT` (variable GitHub) et `SMART_BUDGET_BACKUP_DATABASE_URL` (secret GitHub).
- La clé privée n'est pas transmise à GitHub ni à ChatGPT. Première sauvegarde externe encore à vérifier par un run et un déchiffrement local.
- Les sauvegardes internes (pg_cron) et six protections incident restent inchangées.

## Prochaine action

Faire passer les tests de la PR des sauvegardes, vérifier les avis de sécurité, et laisser la tâche Cron effectuer son premier lancement automatique. Réévaluer ensuite les exports chiffrés hors projet avant d'ajouter une restauration utilisateur.
