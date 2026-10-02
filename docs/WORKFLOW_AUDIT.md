# Audit de migration — 2 octobre 2026

Photographie du dépôt `nishiosxn/budget-app` avant modification du workflow. Les branches et PR doivent être revérifiées avant toute action future.

## Base et publication

- `main` : `e304cc28d5f8018c2101f08cec7d529dec1e65f3`, production V1 ; protégée.
- `develop` : `70f627a4ab93c066323c81993bb1613fbbd92906`, intégration V2.4.1 ; protégée. Base de ce lot documentaire.
- `gh-pages` : `bd8f51ac08178a1fa875cb14ecf6cfe3100ef5fe`, racine V1 et répertoires `v2`, `v2.1`, `v2.2`, `v2.3`, `v2.4`, `v2.4.1`, `v2.4-test`, `v2.5`, `v2.5.1` présents.
- Tags existants : `v2.0`, `v2.1`, `v2.2`, `v2.3`. Aucun tag V2.4/V2.5 dans l'instantané audité ; aucune création ni déplacement prévu.
- Actions : PR vers `main` et `develop`, Node 22, permissions `contents: read`, check **App integrity**. Aucun workflow de publication dans le code source de `develop`.
- L'API publique n'a pas exposé les réglages Pages. La présence des fichiers sur `gh-pages` ne prouve pas à elle seule le succès du dernier déploiement. Aucun réglage ni fichier publié n'est modifié par ce lot.

## Travaux coexistants et nettoyage futur

| Branche historique | SHA court | État observé / condition avant nettoyage |
| --- | --- | --- |
| `docs-v2.4.1-readme` | `9bc5d7d` | Draft PR [#16](https://github.com/nishiosxn/budget-app/pull/16) vers `main` ouverte ; arbitrer son contenu et sa PR avant nettoyage |
| `v2.4` | `7475a0e` | Socle présent dans V2.4.1 ; comparer les écarts et garder les références utiles avant décision |
| `v2.4.1` | `8e2816e` | V2.4.1 intégrée dans `develop` ; vérifier PR et différences, l'ascendance seule ne démontre pas la fusion |
| `v2.4-test` | `a10ed02` | Labo visuel avec preview ; examiner les idées non intégrées avant décision |
| `v2.5` | `0268b29` | Draft PR [#18](https://github.com/nishiosxn/budget-app/pull/18) vers `develop` ouverte, 30 commits après la base ; travail à valider, pas une branche à supprimer maintenant |
| `v2.5.1` | `7b810e0` | 22 commits après `v2.5` ; interface et synchronisation cloud-only en cours, pas de PR ouverte observée lors de l'audit |

Toutes sont candidates à une revue de nettoyage future, avec conservation pendant cette migration. Les tags Git serviront désormais de jalons, mais la décision d'archiver une ancienne branche par un nouveau tag reste explicite. Conserver les previews historiques même après suppression autorisée d'une branche source.

## Écarts corrigés par le lot

Le README et le workstate de `develop` désignaient encore `v2.4.1` comme branche active/prête à fusionner. Le modèle `v2.x` entretenait une branche par version. Le validateur vérifiait seulement une mention de branche dans le workstate, sans cohérence avec la version affichée ni liens documentaires.

Le lot introduit les branches temporaires, la méthode et le guide assistant, un workstate court et un contrôle documentaire. Il ne change ni fichiers applicatifs, ni backend, ni configuration CI/Pages, ni PR préexistantes. Le socle automatique `node scripts/validate.mjs` réussissait avant modification.
