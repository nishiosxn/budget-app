# Workstate — Budget foyer

## État

- Dépôt : `nishiosxn/budget-app`
- Version du code : `V2.4.1`
- Branche de développement de référence : `develop`
- Branche du lot : `work/v2.4.1-workflow-hybride` (temporaire ; après merge, reprendre depuis `develop`).
- Production : `main` → V1 ; publication : `gh-pages`.
- Preview du socle : https://nishiosxn.github.io/budget-app/v2.4.1/
- Lot : adoption du workflow hybride ; aucun changement de version applicative.
- État du lot : implémentation terminée ; Draft PR vers `develop`, revue avant merge.

## Périmètre et décisions

Guide [AGENTS.md](AGENTS.md), [méthode Git/assistant](docs/ASSISTANT_WORKFLOW.md), README actualisé, contrôle documentaire intégré à **App integrity**. Conserver les trois branches permanentes ; nouveaux lots sur `work/vX.Y-<lot>`, tags immuables après décision explicite.

Les branches historiques, tags et publications restent conservés. [L'audit initial](docs/WORKFLOW_AUDIT.md) indique leurs SHA, les PR ouvertes et les conditions de nettoyage futur. V2.5 (Draft PR #18) et V2.5.1 ne sont pas intégrées dans ce lot. La promotion vers `main` et une publication Pages sont des étapes distinctes.

## Invariants du socle

V2.4.1 conserve le schéma V5 et le cache V2.4 isolé par foyer, la synchronisation dernier écrivain gagnant, les archives des suppressions, les invitations explicites, RLS et l'administration côté serveur. Les données financières et secrets serveur restent hors du dépôt.

La validation utilisateur V2.4.1 était déjà terminée avant ce lot. Les détails techniques et audits antérieurs sont conservés dans [la référence V2.4.1](docs/V2_4_1_REFERENCE.md) ; ils ne constituent pas de nouveaux tests réalisés aujourd'hui. Les changements cloud-only de V2.5.1 sont propres à cette branche.

## Validation du lot

- Audit initial : `node scripts/validate.mjs` réussi.
- Validation finale locale réussie : `node scripts/validate.mjs` et `node --test scripts/validate-docs.test.mjs` (9 tests, 0 échec), le 2 octobre 2026.
- Contrôles : documents requis, liens locaux, alignement README/workstate/interface/changelog ; cas négatifs et compatibilité V1.
- CI : **App integrity** doit réussir sur le dernier commit de la PR.
- Fichiers applicatifs et workflow Actions conservés ; aucun déploiement Pages ni changement hébergé effectué.

## Prochaine action

Revoir la Draft PR du lot et vérifier son dernier check **App integrity**, puis fusionner vers `develop` lorsque la livraison est validée. Après merge, clôturer le lot dans ce fichier et nettoyer uniquement sa branche temporaire. Pour reprendre V2.5/V2.5.1, relire leurs PR/différences et intégrer la méthode avec des champs de version adaptés.
