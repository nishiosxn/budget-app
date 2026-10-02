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

## Lot courant — V2.6 Catégories

- Branche : `work/v2.6-categories`
- Base : `develop`
- Objectif : simplifier fortement la page **Catégories** sans modifier Historique, Suivi, Vue d’ensemble, le schéma de données ou Supabase.
- Critères d’acceptation :
  - montant réel directement cliquable ;
  - montant prévu directement cliquable ;
  - action individuelle « réel = prévu » en un clic quand elle est pertinente ;
  - actions secondaires regroupées derrière un menu `⋯` ;
  - suppression toujours confirmée ;
  - « Tout remplir » remplacé par un comportement sûr qui ne remplace pas un réel déjà saisi ;
  - « Tout vider » retiré du premier niveau visuel ;
  - lisibilité desktop/mobile améliorée, avec zones tactiles confortables ;
  - synchronisation et historique des ajustements inchangés.
- Exclusions : aucune modification de la logique de calcul, de la page Historique, de la page Suivi, de la Vue d’ensemble, des migrations ou des règles Supabase.
- Validation prévue : `node --test scripts/validate-docs.test.mjs`, `node scripts/validate.mjs`, **App integrity**, puis validation visuelle utilisateur avant sortie du Draft.
- État : implémentation terminée sur la branche.
- Validation automatique : **App integrity** réussi sur le commit applicatif `145286ed58e51ef35e774117ca815eb6878a9e4b` (workflow GitHub : tests documentaires + audit applicatif). Cette mise à jour documentaire déclenche un dernier contrôle CI.
- Validation navigateur/visuelle : non réalisée dans cette session ; elle reste requise avant sortie du Draft.
- Publication : aucune preview V2.6 publiée à ce stade.

## Prochaine action

Conserver la PR #23 en brouillon, vérifier les validations sur le dernier commit puis faire valider visuellement le nouveau rendu Catégories avant toute sortie du Draft ou publication de preview.
