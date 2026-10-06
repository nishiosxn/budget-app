# Workstate — Budget foyer

## État

- Dépôt : `nishiosxn/budget-app`
- Version du code : `V2.7`
- Branche de développement de référence : `develop`
- Production du code : `main` → V2.6.
- Publication : `gh-pages`.
- Version V2.6 publiée : https://nishiosxn.github.io/budget-app/v2.6/
- V2.6 est la base stable de production du code ; le workflow hybride de la PR #19 reste actif.
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

## Lot courant — V2.7 Stabilisation

- Branche : `work/v2.7-stabilization`
- Base : `develop`
- Objectif : stabiliser la V2.6 publiée avant promotion V2.7 : restauration des catégories, création d’épargne, sauvegarde/reset complets, picker couleur Paramètres, unités relatives et alignement Git/Supabase.
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

## Prochaine action

Valider la preview `/v2.7/`, faire passer **App integrity** sur la PR #26, puis fusionner vers `develop`. La promotion vers `main` restera une opération séparée.
