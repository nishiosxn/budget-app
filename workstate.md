# Workstate — Budget foyer

## État

- Dépôt : `nishiosxn/budget-app`
- Version du code : `V2.5.1`
- Branche de développement de référence : `develop`
- Production du code : `main` → V2.5.1.
- Publication : `gh-pages`.
- Preview V2.5.1 actuellement publiée : https://nishiosxn.github.io/budget-app/v2.5.1/
- V2.5.1 est la base stable de production du code ; le workflow hybride de la PR #19 est actif.
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

## Lot courant — V2.6 Catégories & Vue d’ensemble

- Branche : `work/v2.6-categories`
- Base : `develop`
- Objectif : simplifier fortement **Catégories** puis clarifier la **Vue d’ensemble**, en séparant le reste réel du mois du solde de compte personnel.
- Critères d’acceptation :
  - montant réel directement cliquable ;
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
- Validation automatique : **App integrity** réussi sur le modèle d’attribution unique.
- Migration Supabase `v2_6_account_opening_balances` appliquée, ainsi que son ajout à la publication Realtime.
- Donnée initiale : solde d’ouverture Baptiste pour septembre 2026 = **108,18 €** ; Anaëlle reste non renseignée.
- Septembre Baptiste reconstruit depuis le relevé Boursobank en opérations détaillées : **1 073,64 € attribués en revenus**, **1 051,63 € attribués en dépenses**, solde final vérifié **130,19 €**.
- Catégorie `Aldi` archivée ; l’opération Aldi de 7,96 € est rangée dans `Courses` avec son libellé. Catégorie `Dons` créée pour Fondation de France.
- `Courses` : attribution **Baptiste** uniquement en septembre 2026, puis retour **À deux** à partir d’octobre.
- Validation navigateur/visuelle : à poursuivre sur la preview publique.
- Preview : https://nishiosxn.github.io/budget-app/previews/pr-23/
- Source applicative publiée : `9d5321b3c4c862595ed859adeb306c9ddfb269c7`.
- Commit `gh-pages` de la preview : `cbb607d95fd8a6d0fb4c2d0d97d1ee50eaf0f7be`.

## Prochaine action

Conserver la PR #23 en brouillon et poursuivre la validation visuelle sur `/previews/pr-23/` avant toute sortie du Draft.
