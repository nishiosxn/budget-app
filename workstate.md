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

## Validation du lot

Avant intégration de V2.5.1 dans `develop` :

- `node --test scripts/validate-docs.test.mjs`
- `node scripts/validate.mjs`
- **App integrity** sur le dernier commit de la PR
- vérifier que les fichiers applicatifs V2.5.1 n'ont pas régressé pendant la réconciliation du workflow
- vérifier la preview V2.5.1 déjà publiée comme référence fonctionnelle

La publication actuelle `gh-pages/v2.5.1/` reste intacte pendant cette réconciliation.

## Prochaine action

Pour tout nouveau changement, repartir de `develop` à jour sur une branche temporaire `work/vX.Y-<lot>`. La publication GitHub Pages reste gérée séparément sur `gh-pages`; vérifier son état réel avant toute modification. Le nettoyage des branches historiques peut être effectué après vérification des tags/jalons correspondants.
