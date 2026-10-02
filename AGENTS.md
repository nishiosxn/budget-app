# Guide Codex / Work — Budget foyer

Format : [instructions AGENTS.md officielles](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Reprendre une session

Lire [workstate.md](workstate.md), puis [la méthode](docs/ASSISTANT_WORKFLOW.md) et le README. Vérifier la branche réelle, les changements locaux, les références distantes et les PR avant de choisir la base. L'état écrit peut dater : les commits et les checks GitHub font foi.

## Git et livraison

- `main` (production), `develop` (intégration) et `gh-pages` (publication) sont permanentes.
- Pour un nouveau lot, partir de `develop` à jour et créer `work/vX.Y-<lot>` ; un correctif peut utiliser `work/vX.Y.Z-<lot>`. Continuer une branche existante si la demande la concerne.
- Ouvrir une Draft PR vers `develop` tôt, avec objectif, périmètre, validations et tâches restantes. Conserver le brouillon jusqu'à la fin des tests et de la validation utilisateur applicable.
- Ne pas pousser directement sur les branches protégées, forcer l'historique ou contourner **App integrity**. La promotion `develop` → `main` se fait par une PR distincte de release.
- Les tags `vX.Y[.Z]` identifient un commit validé et sont immuables. Leur création exige une décision explicite de jalon/release ; jamais de déplacement ni de remplacement silencieux.
- Après merge, supprimer uniquement la branche temporaire du lot quand les travaux et références utiles sont conservés. Une fusion squash se vérifie par la PR fusionnée, pas seulement par l'ascendance Git.
- Les branches historiques recensées dans [l'audit](docs/WORKFLOW_AUDIT.md) restent intactes pendant cette migration. Leur nettoyage nécessite une décision distincte.

## Implémenter et vérifier

Préserver les changements de l'utilisateur. Limiter chaque lot à son périmètre. L'application est statique, sans étape de build : exécuter depuis la racine `node scripts/validate.mjs` et, pour un changement du contrôle documentaire, `node --test scripts/validate-docs.test.mjs`. Compléter par des tests navigateur ciblés lorsque le comportement change ; ne pas annoncer des tests manuels non réalisés.

Préserver les formules financières, les migrations non destructives, l'isolation des foyers et les contrôles d'accès. Ne jamais versionner de données financières personnelles ni de secrets serveur. Les modifications du backend hébergé exigent un périmètre explicite ; ne pas les déclencher pour une mise à jour documentaire.

## Continuité et publication

Mettre à jour `workstate.md` avec le lot, son état, les preuves de validation et la prochaine action. Conserver les détails durables dans la documentation et les changements livrés dans `CHANGELOG.md`. Aligner le champ « Version du code » du README et du workstate avec l'interface ; la version du cache ou du schéma peut être différente.

Publier seulement si la demande le prévoit. Utiliser un checkout séparé de `gh-pages`, conserver la racine de production et les previews antérieures, publier les seuls fichiers applicatifs nécessaires dans le répertoire prévu et enregistrer le SHA source. Ne pas recopier les scripts, migrations ou documents de travail dans une preview. Voir la checklist de publication dans la méthode.
