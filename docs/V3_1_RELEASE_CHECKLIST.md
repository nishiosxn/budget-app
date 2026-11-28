# Livraison Smart Budget V3.1

État au 28 novembre 2026 : recette locale 8B clôturée, intégration estimée à 95 %, PR #52, branche `work/v3.1-integration`. Référence de recette `a6fa3ead1020f515a2d9fdd54a66fba8dc6ccde7`. La référence applicative initiale du sous-lot 8A était `3b46bc246c358155394ded30d897c7793231f7bf`. L'interface et les documents utilisent V3.1 préversion. Les suffixes de ressources comme 31au désignent leurs révisions.

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

## Clôture de la recette locale 8B

Référence validée : `a6fa3ead1020f515a2d9fdd54a66fba8dc6ccde7`, [intégrité et PostgreSQL](https://github.com/nishiosxn/budget-app/actions/runs/46084716412), [recette connectée](https://github.com/nishiosxn/budget-app/actions/runs/46084716354). Les deux workflows et toutes les étapes de recette connectée sont réussis.

La recette couvre le contrat historique synthétique, les six gardes d'écriture, les restrictions RLS/ACL, la reprise du Builder, la rétention des propositions, les véritables interfaces V3.0/V3.1 et le client 31ap/Edge v30 avant et après migration. Les sections historiques suivantes décrivent la progression des travaux ; leurs attentes de CI sont levées pour cette référence locale. Les validations sur le schéma hébergé cible, les sauvegardes/restaurations et les autres points de livraison restent ouvertes. Aucun changement sur Supabase hébergé ni publication.

## Audit 8B et adaptation 8B.4A

Le quota Supabase gratuit de deux projets actifs a empêché la création d’un staging hébergé. Une recette dans le projet partagé reste une option **non autorisée**, à condition de verrouiller le pilote côté serveur et de prouver la coexistence V3.0/V3.1 avant toute migration. L’audit a retrouvé les six triggers historiques, les ACL réelles et quatre identifiants de migrations historiques divergents. Ne pas rejouer aveuglément les migrations.

Le contrat CI et la limite Builder sont corrigés en source dans le lot 8B.4A ; confirmer les workflows sur la nouvelle révision. Restent la reconstitution complète des politiques/contraintes, la protection du brouillon contre V3.0, le filtrage pilote du Builder et des règles, la recette Edge v30 et la rétention des brouillons. La procédure de préversion isolée ci-dessous n’est pas remplacée par une autorisation de production.

## Pilotage 8B.4B (historique, validé en CI locale)

Les migrations V3.1 non encore hébergées introduisent des listes privées, vides par défaut : `private.v31_pilot_builder_users` (comptes de test autorisés à créer/reprendre un Builder) et `private.v31_pilot_rule_members` (paires foyer/utilisateur autorisées pour les règles). L'opérateur doit faire approuver le périmètre exact avant toute inscription ; aucun UUID réel ni commande de déploiement n'est inclus. Les autorisations Edge restent distinctes. Pour un retrait de pilote avec brouillon non terminé, conserver l'accès de reprise jusqu'à finalisation ou élaborer une récupération administrative revue ; ne pas supprimer un brouillon sans autorisation. Les tests CI utilisent des identités jetables.

Les gardes du Builder bloquent les écritures REST sur un foyer en attente et les invitations prématurées, tout en conservant le provisionneur historique. Vérifier les deux workflows et la recette V3.0/V3.1 avant migration ; le test REST ne remplace pas une recette des deux interfaces réelles.

## Contrat RLS et rétention 8B.4C (historique, validé en CI locale)

Le contrat local reproduit désormais les droits et prédicats RLS historiques principaux, y compris le contrôle du propriétaire désigné. Il reste synthétique, notamment les détails des clés étrangères/cascades et les migrations historiques divergentes. Vérifier les tests CI avant de le considérer représentatif pour la coexistence. Les workflows 8B.4A et 8B.4B sont référencés dans le workstate.

La rétention des propositions Assistant efface leur champ `actions` après 24 h, à la consultation ou via `private.purge_expired_smart_assistant_reviews(integer)` par lots bornés. Les tombstones (identifiant, empreinte et statut) et les reçus sont conservés afin de refuser une ancienne requête ou de restituer un reçu existant ; aucun effacement de l'historique financier. La fonction n'est pas callable par les rôles clients ni service_role. Après validation et autorisation distincte, prévoir une tâche administrative quotidienne avec limites, suivi du nombre de lignes et contrôle de la durée ; aucune planification n'est installée par cette migration. Les copies de sauvegarde suivent leur propre rétention ; le Builder non finalisé est exclu de cette purge.

## Recette coexistence 8B.5A (historique, validée en CI locale)

Voir [le protocole de coexistence](V3_1_COEXISTENCE.md). La CI de 8B.4C a révélé une erreur de syntaxe SQL, corrigée en source. Le nouveau test utilise les véritables pages V3.0 épinglées et V3.1, avec comptes fictifs et reprise du Builder. La CI et l'identité exacte de l'Edge v30 restent à valider ; aucune autorisation hébergée n'est implicite.

## Edge historique 8B.5B (historique, validé en CI locale)

Les six fichiers v30 récupérés en lecture seule sont identiques à 3b6a340352432428b8145aab086741a995cb6f8a. La recette CI exporte ce commit, teste les confirmations historiques et le quota sur le schéma jetable migré, sans fournisseur externe. Voir [protocole](V3_1_COEXISTENCE.md). CI à confirmer ; comparaison avant/après sur deux états et client historique 31ap encore ouverts.

## Recette 8B.5C (historique, validée après correctif 8C.1)

Les quatre workflows de 889d0e8 et 98f124d sont verts. Le nouveau scénario avant/après et client 31ap est ajouté ; attendre ses résultats avant de clôturer la recette locale. La perte définitive d'accès au compte nécessite une décision administrative de récupération distincte ; aucun contournement d'Auth, transfert ou suppression de brouillon automatique. Le contrat historique demeure synthétique, notamment les cascades et divergences de journal. La recette sur projet partagé reste soumise à une autorisation séparée, à une sauvegarde et à la vérification du schéma cible. Gemma réel reste non exécuté.

## 8C.1 — préparation du benchmark

Plan hors ligne des 153 cas fournisseur, verrou de gratuité et plafonds dans le runner. Voir [benchmark](V3_1_ASSISTANT_BENCHMARK.md). Aucun appel réel ; compte Free et solde à vérifier avant activation. Le dernier test historique 8B.5C a échoué à l'ouverture du client ; export des ressources historiques corrigé, CI à confirmer. Ne pas clôturer 8B avant succès.

## 8C.4 — diagnostic réel

Premier lot : 5 HTTP 200, 0/5 exacts sur une intention répétée, 3 354 tokens, 615 neurones réservés, consommation effective non relevée. Instrumentation détaillée et lot diversifié de cinq cas (un retest borné) préparés ; aucun nouvel appel. Voir [benchmark](V3_1_ASSISTANT_BENCHMARK.md). Attendre CI verte et rapport diagnostic avant modification du moteur. Le contrôle fournisseur reste ouvert.

## 8C.6 — reprise après refus HTTP 401

Rapport de diagnostic : 1 requête refusée (401), zéro token rapporté, 738 neurones réservés au cumul UTC, quatre cas non envoyés. Préflight catalogue et récupération unique conditionnée au rapport original + registre préparés ; aucun appel supplémentaire. Voir [benchmark](V3_1_ASSISTANT_BENCHMARK.md). CI connectée 501644f en échec sur la protection anti-archivage historique (15 lignes) ; diagnostic de test renforcé, garde intact. La preuve de recette locale a6fa3ea demeure historique, mais la dernière révision ne peut pas être considérée verte. Vérifier la nouvelle CI avant reprise.

## 8C.6B — correction des réponses réelles Gemma

Récupération 401 : 5 HTTP 200, 1/5 exact ; 3 288 tokens, 616 neurones réservés (1 354 cumul UTC). Quatre causes isolées, rejeu des structures métier réelles et protections ciblées côté normalisation fournisseur, CI à confirmer. Aucun nouvel appel. CI connectée 54536ce échouée : ancien client réintroduit des catégories par défaut et garde anti-archivage déclenché, coexistence non validée pour la dernière révision. Aucun déploiement. Voir [benchmark](V3_1_ASSISTANT_BENCHMARK.md).

## 8C.7 — rejeu Gemma et correction de coexistence

CI f595303 : 336 tests verts, rejeu des cinq réponses capturées 5/5, PostgreSQL réussi (46088280355). Le client historique réinjecte les catégories neutres lorsque la liste de base est vide. Correctif de compatibilité dans la migration Builder non publiée, marqueurs archivés sans budget, protections et vérifications croisées supplémentaires ; nouvelle CI à confirmer. Aucun appel IA ni modification hébergée. Voir [coexistence](V3_1_COEXISTENCE.md).

## 8C.9 — paquet de préversion isolé

Le workflow d'intégrité prépare désormais un paquet à partir des blobs du SHA exact, avec liste de ressources autorisées, contrôles de dépendances et de portée PWA, empreinte SHA-256 et exclusion des migrations, tests et secrets. Les trois configurations navigateur sont remplacées par une URL loopback et une clé fictive non utilisable ; aucune cible hébergée ne peut être fournie à cet outil. Artefact CI uniquement, aucune publication Pages. Le paquet n'est pas encore connecté à une recette hébergée ; CORS/Auth et schéma cible restent à valider. CI de coexistence du commit 68a61fd encore en cours au moment de cette préparation. Aucun nouvel appel Gemma, aucun jeton demandé à l'opérateur.

## 8C.9 — preuve du paquet et relance de la recette

CI 40b35e6 : 339 tests réussis, PostgreSQL vert ; artefact `smart-budget-v31-preview` (74 fichiers, empreinte du paquet `07aea062b1b6b3fdb174b9a8ba17858939bd4f1151dfb1b2fe2ad3cc0f9b89ff`), workflow 46088804362. La CI connectée 68a61fd a échoué sur un état local constitué de catégories neutres avant écriture. La relance Auth redondante est une cause plausible ; correctif de disponibilité V3.1 et test de bootstrap stabilisé ajoutés sans changer le client historique. Nouvelle CI à confirmer. Aucune publication ni modification hébergée.

## 8D.1 — audit hébergé et sauvegardes

Voir [audit hébergé](V3_1_HOSTED_PREFLIGHT.md). Catalogue et métadonnées vérifiés le 28 novembre : 24 migrations historiques, quatre nouvelles absentes, six gardes actifs, RLS sur les neuf tables contrôlées, aucune collision de marqueurs réservés. Dernière sauvegarde automatique terminée à 00:17 UTC, huit tables historiques ; couverture des futurs objets privés et export chiffré/restauration à compléter. Conseiller sécurité : quatre INFO et cinq WARN à qualifier. Aucun changement hébergé. CI b592fcc application/PostgreSQL réussie, coexistence en cours.

## 8D.2 — sauvegarde et restauration d'exercice

Coexistence b592fcc entièrement verte (46089009807). Recette chiffrée automatisée ajoutée sur pile jetable, cinq schémas applicatifs, comparaison d'intégrité et droits, récupération du brouillon et du reçu avec rejeu sans double écriture. Auth fictif reconstitué séparément ; restauration complète Auth/Storage et archive externe réelle non validées. CI de la recette nouvelle à confirmer. Aucun changement hébergé.

## 8D.3 — préparation de la préversion connectée

Coexistence 80239dd également verte (46089273241). CI bc759c4 : application/PostgreSQL verts, exercice de restauration en attente. La connexion Supabase Budget ne présente qu'un projet actif, la production ; aucune cible isolée hébergée confirmée. Nouveau contrôle du paquet exact dans la recette Chromium locale, avec confirmation déterministe et isolation. Voir [contrat de déploiement](V3_1_PREVIEW_DEPLOYMENT.md) : origine HTTPS distincte, configuration publique de recette seulement, Auth/CORS/Edge et garde de publication. Aucun changement hébergé.

## Checklist ouverte

Chaque validation est clôturée avec un environnement, un SHA et une preuve.

- [x] Recette locale 8B sur Supabase jetable (preuve : workflows 46084716412 et 46084716354 du SHA `a6fa3ea`).
- [x] Forfait Workers Free et absence de moyen de paiement confirmé par captures de l'opérateur ; solde de 10 000 neurones au relevé, à contrôler à nouveau avant chaque exécution.
- [ ] Gemma réel sur compte Workers Free confirmé, sans facturation, corpus fictif et budget borné. Mesurer justesse financière, tokens, latence et consommation du compte. Les 153 cas non résolus localement restent à évaluer ; premier lot de cinq à lancer manuellement.
- [ ] Projet Supabase de test isolé identifié et autorisé. Comparer son schéma avec la cible à partir d'un export sans données, notamment contraintes, RPC, Edge, permissions et RLS.
- [x] Définitions des six déclencheurs historiques du 16 novembre retrouvées et reproduites dans la recette locale ; comportement CI validé.
- [ ] Vérifier leur identité et leur comportement sur le schéma cible de la future recette hébergée autorisée.
- [x] Anciens clients testés sur la base jetable, dont en-têtes obsolètes, provisionnement historique, gardes et coexistence avant/après migration.
- [ ] Confirmer ces protections sur l'environnement cible autorisé avant livraison.
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

Première tâche à reprendre : vérifier les workflows de coexistence et de préparation du paquet isolé. Les cinq réponses capturées Gemma ont été rejouées avec succès ; aucune nouvelle inférence sans accès serveur autorisé et contrôle de quota. L'opérateur ne doit effectuer aucune manipulation technique. Pour la recette hébergée, identifier le projet de test autorisé, comparer son schéma sans données et appliquer la revue du [rapport connecté](V3_1_CONNECTED_ACCEPTANCE.md). Toute migration ou mise à jour Edge hébergée demande une revue et une autorisation distinctes.

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
