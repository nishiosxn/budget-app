# Méthode de travail hybride

Cette méthode reprend de GamePanel les lots courts, les checkpoints, les PR et les tags, avec un tronc `develop` et une branche de publication adaptés à Budget foyer.

## Branches et versions

| Référence | Rôle | Durée |
| --- | --- | --- |
| `main` | Code validé de production ; V1 au moment de la migration | Permanente |
| `develop` | Intégration de la future V2 ; V2.4.1 au moment de la migration | Permanente |
| `gh-pages` | Site publié, racine de production et previews | Permanente |
| `work/vX.Y-<lot>` | Un lot isolé depuis `develop` | Temporaire |
| `work/vX.Y.Z-<lot>` | Même convention pour un correctif | Temporaire |
| `vX.Y[.Z]` (tag) | Commit source validé, identifié de façon immuable | Conservé |

Exemples : `work/v2.6-navigation`, `work/v2.5.1-workflow`. La version dans le nom indique le lot cible, pas une release déjà livrée. Un lot documentaire peut garder la version du code existante. Ne pas créer une nouvelle branche permanente à chaque version.

Une preview est une publication web ; elle ne remplace pas un tag source. Un cache (`budget-foyer-v2.4`) ou un schéma (V5) a son propre cycle et ne doit pas être renommé mécaniquement avec la version de l'interface.

## Cycle d'un lot

1. Lire `AGENTS.md` et `workstate.md`. Examiner `git status`, les branches distantes et les PR ouvertes. Actualiser `origin/develop` et choisir une base sans écraser un travail local.
2. Créer la branche du lot depuis `origin/develop`, sauf continuation explicite d'un travail existant. Écrire objectif, critères d'acceptation et exclusions dans le workstate.
3. Ouvrir une **Draft PR vers `develop`**. Indiquer changements attendus, tests prévus, risques et éventuelle preview. Faire des commits cohérents et des checkpoints lisibles.
4. Implémenter, exécuter `node scripts/validate.mjs`, compléter les tests ciblés et mettre à jour documentation et changelog. Pour le contrôle documentaire, exécuter aussi `node --test scripts/validate-docs.test.mjs`.
5. Si une preview est demandée, appliquer la checklist ci-dessous. La validation utilisateur des changements fonctionnels/visuels et le check **App integrity** sur le dernier commit précèdent la sortie du brouillon.
6. Passer la PR en revue, puis fusionner vers `develop` dans le cadre de la livraison autorisée, en respectant les protections. Une Draft PR n'est pas une autorisation de merge automatique.
7. Mettre à jour la continuité du projet. Supprimer la branche temporaire du lot après merge lorsque rien d'utile n'en dépend. Pour une fusion squash, vérifier l'état merged de la PR et l'absence de nouveaux commits sur la branche ; `git branch --merged` seul ne suffit pas.

Pour synchroniser une branche avec `develop`, privilégier un merge si elle est déjà partagée. Ne pas réécrire son historique sans accord. Les branches historiques et les PR déjà ouvertes continuent leur cycle actuel ; ce changement ne les renomme ni ne les fusionne.

## Jalons et release

Après validation d'un jalon, une décision explicite peut autoriser un tag annoté `vX.Y[.Z]` sur le SHA source validé. Vérifier d'abord que le nom est libre localement et à distance, puis enregistrer SHA, validations et URL de preview/release. Un tag sur `develop` peut désigner un jalon de preview ; il n'indique pas à lui seul une mise en production. Ne jamais créer un tag à partir d'une preview non vérifiée.

La sortie en production utilise une PR distincte `develop` → `main`, avec tests, notes de release, migrations éventuelles et plan de retour arrière. Après validation et merge, la publication de la racine Pages est une opération distincte. Un tag de release référence le commit livré ; il reste immuable. En cas d'erreur, utiliser un nouveau correctif/tag, jamais déplacer l'ancien. Aucun tag n'est créé rétrospectivement pendant la migration du workflow.

## Publication GitHub Pages

Le workflow `.github/workflows/validate.yml` contrôle les PR ; il ne déploie pas le site. La branche `gh-pages` conserve les publications. Avant une publication, vérifier la configuration Pages réelle dans GitHub et le dernier déploiement ; l'audit initial n'a pas pu lire cette configuration via l'API publique.

- Utiliser un checkout séparé de `gh-pages`, actualisé, avec le répertoire cible choisi explicitement. Une preview utilise `/vX.Y[.Z]/` ; la production utilise la racine.
- Copier les fichiers applicatifs nécessaires (HTML, CSS, JS, admin et, selon la version, manifest/service worker/icônes). Conserver les chemins relatifs ; ne pas utiliser un nettoyage global de `gh-pages`.
- Préserver la racine V1 et tous les répertoires historiques. La mise à jour d'une preview encore en test doit être explicite et traçable ; un snapshot figé exige une nouvelle destination.
- Respecter la stratégie de données de la version : isolation de cache si elle utilise un stockage local, aucune réintroduction de cache financier sur une version cloud-only. Vérifier les chemins et scopes PWA et les URL de retour Auth si concernés.
- Enregistrer le SHA source et l'URL dans la PR/workstate. Vérifier le succès du déploiement, le chargement des ressources et les parcours concernés dans le navigateur. Un commit publié sans ces vérifications n'est pas une preuve de déploiement réussi.

## Répartition documentaire

- `AGENTS.md` : règles courtes pour Codex/Work.
- `README.md` : accès, version du code de ce checkout, architecture et point d'entrée vers la méthode.
- `workstate.md` : état du lot, validations réelles, blocages et prochaine action ; pas de journal exhaustif.
- `CHANGELOG.md` : historique durable des changements ; les mentions de branches dans les anciennes entrées restent historiques.
- [WORKFLOW_AUDIT.md](WORKFLOW_AUDIT.md) : photographie de migration et candidates au nettoyage futur.

Les champs « Version du code » sont alignés avec les marqueurs de l'interface et une entrée de changelog. Le validateur contrôle aussi l'existence des documents et leurs liens Markdown locaux. Il n'exige pas le nom de branche courant : un checkout détaché et le commit de merge CI doivent fonctionner.

La validation automatique ne remplace pas une validation utilisateur ni les contrôles de sécurité hébergés. Une reprise de V2.5/V2.5.1 devra intégrer ces règles et mettre à jour les champs de version avant sa PR d'intégration.
