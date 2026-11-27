# Livraison Smart Budget V3.1

État du sous-lot 8A au 28 novembre 2026. Intégration estimée à 94 %, PR #52, branche `work/v3.1-integration`. Référence applicative `3b46bc246c358155394ded30d897c7793231f7bf`. L'interface et les documents utilisent V3.1 préversion. Les suffixes de ressources comme 31au désignent leurs révisions.

## Fonctionnalités et preuves acquises

| Chantier | Réalisé et vérifié | Preuve et limite |
| --- | --- | --- |
| Socle | Correctif administration, skill Unslop et crédits, gardes de synchronisation et d'archivage conservés | Revue et tests versionnés. Le schéma historique hébergé reste à comparer. |
| Builder | Sept étapes, seul/à deux, abonnements annualisés en centimes, bilan détaillé, identifiants stables et reprise du brouillon reçu par le serveur | Création solo/duo, invitation et interruptions sur Supabase jetable. La fermeture avant première réception serveur peut perdre la saisie. |
| Catégories | Répartition, comparaisons, infobulles, remplissage des vides, suppressions confirmées et annulation | Recette multi-sessions, changements de mois et préservation de l'historique fictif. |
| Assistant | Huit commandes de référence déterministes, catégories/budgets/mouvements mixtes, payeurs, récurrences, épargne selon le modèle, revalidation serveur et reçus atomiques/idempotents | PostgreSQL et Edge locaux, concurrence, isolation et reçu perdu. Les transferts se limitent aux capacités existantes, certaines propositions hors périmètre restent simulées. |
| IA | Règles locales, contexte réduit, plafonds et erreurs distinctes | 208 commandes fictives, 55 résultats locaux exacts, aucun appel Gemma réel. [Benchmark](V3_1_ASSISTANT_BENCHMARK.md) |
| Interface et PWA | Thèmes, couleurs personnalisées, focus, progression et chargement différé du laboratoire | 319 tests Node, neuf largeurs de 320 à 1 920 px, 270 mesures Chromium, zoom émulé 200 %, gestes et reduced-motion. [Recette](V3_1_VISUAL_ACCEPTANCE.md) |

La recette locale finale a mesuré trois chargements de 157,5 / 107,7 / 112 ms, soit une médiane de 112 ms, 770 938 octets décodés et 89 068 octets de scripts différés. Ces valeurs proviennent du serveur local CI. Le service worker fonctionne en réseau direct et les opérations exigent une connexion.

- [App integrity et PostgreSQL sur le code de référence](https://github.com/nishiosxn/budget-app/actions/runs/46081173693)
- [Recette connectée finale et PWA](https://github.com/nishiosxn/budget-app/actions/runs/46081173687)
- [Captures finales et mesures](https://github.com/nishiosxn/budget-app/actions/runs/46081173687/artifacts/15236683577)
- [Migrations, sauvegarde et retour arrière](V3_1_CONNECTED_ACCEPTANCE.md)

## Audit 8B et adaptation 8B.4A

Le quota Supabase gratuit de deux projets actifs a empêché la création d’un staging hébergé. Une recette dans le projet partagé reste une option **non autorisée**, à condition de verrouiller le pilote côté serveur et de prouver la coexistence V3.0/V3.1 avant toute migration. L’audit a retrouvé les six triggers historiques, les ACL réelles et quatre identifiants de migrations historiques divergents. Ne pas rejouer aveuglément les migrations.

Le contrat CI et la limite Builder sont corrigés en source dans le lot 8B.4A ; confirmer les workflows sur la nouvelle révision. Restent la reconstitution complète des politiques/contraintes, la protection du brouillon contre V3.0, le filtrage pilote du Builder et des règles, la recette Edge v30 et la rétention des brouillons. La procédure de préversion isolée ci-dessous n’est pas remplacée par une autorisation de production.

## Checklist ouverte

Chaque validation est clôturée avec un environnement, un SHA et une preuve.

- [ ] Gemma réel sur compte Workers Free confirmé, sans facturation, corpus fictif et budget borné. Mesurer justesse financière, tokens, latence et consommation du compte. Les 153 cas non résolus localement restent à évaluer.
- [ ] Projet Supabase de test isolé identifié et autorisé. Comparer son schéma avec la cible à partir d'un export sans données, notamment contraintes, RPC, Edge, permissions et RLS.
- [ ] Retrouver et comparer les définitions des six déclencheurs historiques du 16 novembre. Vérifier leur comportement sur l'environnement représentatif.
- [ ] Anciens clients testés contre cet environnement, dont en-têtes obsolètes, provisionnement historique, archivages massifs et absence d'écrasement.
- [ ] Brouillon initial Builder conservé de façon sécurisée avant première réception serveur, ou limite explicitement acceptée avant livraison. Le garde de sortie actuel ne couvre pas une fermeture forcée.
- [ ] Administration privilégiée testée avec un compte administrateur fictif autorisé. Les écrans de connexion/refus sont déjà contrôlés.
- [ ] iPhone physique testé en Safari et PWA, clavier virtuel, safe areas, zoom manuel, VoiceOver et thèmes selon le protocole de recette visuelle.
- [ ] Contrôles d'accessibilité complets au-delà des contrastes ciblés, et dictée sur navigateur compatible.
- [ ] Export chiffré et restauration d'exercice incluant brouillons et reçus privés vérifiés sur environnement isolé.
- [ ] Configurations de la préversion reliées exclusivement au projet de test. Les configurations actuelles pointent vers le projet hébergé existant.
- [ ] Paquet, origine CORS, comptes fictifs, dossier Pages et retour arrière revus, puis autorisation explicite de publication obtenue.

Gemma peut rester désactivé durant une recette déterministe. Toute limite non clôturée figure dans la portée annoncée de la préversion. La livraison stable attend une décision explicite sur les points ouverts.

## Reprise de la prochaine session

Dans un clone GitHub standard, relever la tête distante et les changements locaux avant de continuer.

```powershell
git status -sb
git log -5 --oneline
git fetch origin work/v3.1-integration gh-pages
git diff --ignore-cr-at-eol
git rev-parse origin/work/v3.1-integration
node --test scripts/validate-docs.test.mjs
```

Le dossier de travail de la session 8A est `v31-integration` sous le projet ChatGPT local. Son historique local reconstruit utilise des SHA différents. Comparer les arbres, puis utiliser un clone standard pour préparer une publication. Le commit documentaire succède au code de référence et ne change pas l'application.

Première tâche à reprendre : identifier le projet Supabase de test et obtenir son export de schéma sans données, puis appliquer la revue du [rapport connecté](V3_1_CONNECTED_ACCEPTANCE.md). Toute migration ou mise à jour Edge hébergée demande une revue et une autorisation distinctes.

## Procédure de préversion à exécuter après autorisation

Chemin proposé immuable `/v3.1/integration/<SHA-source>/`, URL prévue `https://nishiosxn.github.io/budget-app/v3.1/integration/<SHA-source>/`. Ce chemin garde les préversions live, unslop et les snapshots existants. La publication frontend et le déploiement backend ont des autorisations distinctes.

1. Figer le SHA applicatif revu et les versions backend de test. Vérifier la CI de cette révision et les conditions de la checklist. Préparer un paquet depuis les fichiers suivis.
2. Dans le paquet seulement, remplacer les URL et clés publiques de `js/supabase-config.js`, `js/supabase-client.js` et `preview/assistant/live/config.js` par celles du projet de test. Inspecter aussi `admin/` et les autres références d'origine hébergée. Une clé serveur reste exclusivement dans le backend.
3. Copier la fermeture complète des dépendances frontend de `index.html`, `assistant/` et `admin/`, dont les styles/scripts partagés de `preview/assistant/`, ainsi que manifeste, worker et icônes. Exclure les scripts de tests, migrations, documents et données. Vérifier tous les liens locaux, les ressources différées et les chemins relatifs sur une origine locale.
4. Vérifier CORS, Auth et redirections pour l'origine GitHub Pages et le chemin dédié. Le chemin frontend ne suffit pas à isoler un foyer. Restreindre les accès backend aux utilisateurs et foyers fictifs autorisés. Garder Gemma désactivé jusqu'à sa validation.
5. Contrôler sur le paquet les routes principales, la version V3.1, les thèmes, la reprise et le service worker. Consigner le SHA source et l'empreinte du paquet dans `preview-source.json`, sans secret.
6. Revoir le diff de publication, puis demander l'autorisation sur ce paquet précis. Les commandes ci-dessous servent de trame à la prochaine session.

```powershell
# À préparer dans un clone standard, une fois le SHA revu choisi.
$sourceSha = '3b46bc246c358155394ded30d897c7793231f7bf'
$package = Join-Path (Split-Path (Get-Location)) ('v31-package-' + $sourceSha)
$pages = Join-Path (Split-Path (Get-Location)) 'budget-pages-v31'
git worktree add --detach $package $sourceSha
git worktree add --detach $pages origin/gh-pages
$targetRelative = 'v3.1/integration/' + $sourceSha
$target = Join-Path $pages $targetRelative
if (Test-Path -LiteralPath $target) { throw 'Chemin déjà publié, choisir une nouvelle révision' }
# Préparer les configurations de test et la liste de dépendances selon les étapes 2 à 5.
# Copier seulement les fichiers revus vers $target, puis contrôler le diff.
git -C $pages status --short
git -C $pages diff --check
```

Après autorisation, créer un commit Pages limité au dossier dédié, vérifier que tous les chemins modifiés commencent par `$targetRelative/`, pousser en avance rapide sur `gh-pages` et attendre la CI Pages. En cas d'avancement concurrent, repartir de sa nouvelle tête et réappliquer uniquement ce dossier. Relever l'URL réellement servie, charger chaque ressource et inspecter les requêtes réseau. Ne communiquer l'URL comme fonctionnelle qu'après ce contrôle.

Retour arrière frontend : restaurer uniquement le dossier de cette révision ou ajouter un commit qui retire cette publication précise, après revue du diff. Garder les anciennes préversions et le backend de test disponibles pour réconcilier les reçus. La restauration des données suit le rapport connecté et exige une autorisation séparée.
