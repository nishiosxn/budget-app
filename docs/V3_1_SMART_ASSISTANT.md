# V3.1 — Smart Assistant

Statut : chantier isolé. Le frontend de laboratoire ne fait aucune écriture financière et le fournisseur n'est pas activé.

## Plan
1. Violet #5C29D6, logo et thème. Préserver les préférences ; terminer les icônes PNG/ICO et l'audit de contrastes.
2. Proxy IA authentifié, quota durable et modèle configurable. Cloudflare Qwen3 candidat, alternatives selon disponibilité et résultats. JSON toujours revalidé.
3. Dépense/revenu unique ou mensuel, épargne, budget prévu : catalogue réel, centimes entiers, dates exactes, brouillon, confirmation, revalidation, doublons et idempotence, moteur sync existant.
4. Mémoire des associations marchands/catégories, opt-in, RLS par foyer, suppression possible. Aucune migration appliquée ici.
5. Conversation et dictée française ; saisie clavier en secours ; calculs exclusivement par Smart Budget.
6. Benchmark 200 commandes françaises, sécurité, quota, tests d'échec, concurrence et récurrences, vrais tests iOS/desktop sur foyer isolé. Pas de fusion ni publication avant validation.

## Contrat
draft : operations [{kind,categoryId,owner,amountCents,date,label,frequency}], max 12, propriétaires B/A/common, fréquence once/monthly.
query : {kind,query,month,compareMonth,categoryId,owner}, outils summary/categories/transactions/comparison.
clarify : demander une précision ; answer : aide générale, sans chiffres financiers inventés.
Les occurrences scope forward sont comptabilisées par la logique actuelle et ne prouvent pas un débit bancaire.
Seule la session et l'adhésion en base autorisent l'accès. Aucun secret client, SQL arbitraire, paiement, suppression massive, ni mutation côté modèle.
L'interface est un laboratoire, sans écriture, tant que le chemin de confirmation n'est pas validé.

## Sources
- https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/
- https://developers.cloudflare.com/workers-ai/features/json-mode/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/get-started/rest-api/

## Passerelle IA (code préparé, non déployé)

Le handler exige l'activation explicite et les listes positives de foyers et utilisateurs de test. Il vérifie le jeton avec Auth puis le rattachement au foyer sous RLS. Le catalogue envoyé au modèle est reconstruit à partir des catégories et du foyer réellement accessibles ; le corps client n'est pas une autorité. Les montants historiques ne sont pas envoyés. Le seul calcul distant est l'interprétation du prompt ; les requêtes budgétaires sont exécutées localement.

Variables serveur (jamais dans GitHub ni dans le navigateur) : SMART_ASSISTANT_ENABLED, SMART_ASSISTANT_MODEL, SMART_ASSISTANT_CF_ACCOUNT_ID, SMART_ASSISTANT_CF_TOKEN, SMART_ASSISTANT_TEST_HOUSEHOLDS, SMART_ASSISTANT_TEST_USERS, SMART_ASSISTANT_SUPABASE_PUBLISHABLE si nécessaire. Ne rien activer avant le test du quota durable. La RPC reserve_smart_assistant_quota n'est pas installée. Si elle manque ou refuse, aucun appel au LLM n'est effectué. À concevoir et tester dans un projet isolé avec le contrôle des permissions et un plafond journalier global, puis valider les droits avant déploiement.

La réponse de Qwen doit être vérifiée en direct (JSON mode documenté mais compatibilité réelle du modèle à confirmer). Pas de fallback silencieux vers un modèle payant. Les tests actuels utilisent un fournisseur simulé pour contrôler la validation et les chemins 401/403/429/503/422/502 ; ils ne prouvent pas la qualité de compréhension du LLM. Aucun secret n'a été renseigné.

## Préparation de la confirmation et banc d'essai
Le planificateur pur produit un patch en mémoire à partir d'un lot validé, sans modifier son entrée ni appeler saveState. Il transforme les revenus/dépenses uniques ou mensuels et l'épargne dans le format existant, et les budgets dans les stores month/forward. Il rejette les doubles propositions et les identifiants de lot déjà utilisés. Ce module n'est volontairement pas raccordé à un bouton d'enregistrement : avant intégration, vérifier une baseline fraîche, expansion des récurrences pour les mois ciblés, propriétaire du budget à sa date, doublons avec opérations bancaires futures, réutilisation de la synchronisation existante et statut réellement synchronisé.

200 scénarios fictifs FR (20 intentions et 10 formulations) sont disponibles dans scripts/assistant-benchmark-fixtures.mjs. Le test CI vérifie les attentes et leur compatibilité avec le contrat, pas l'interprétation par un modèle. Le runner scripts/assistant-benchmark.mjs n'a aucun accès au foyer et ne fait aucun appel sans --live, confirmation préalable du forfait gratuit et identifiants côté environnement. Limite 10 cas par lancement, arrêt sur erreur, aucune bascule vers un service payant. Exécuter ensuite par lots pour comparer les modèles et publier les scores réels. Aucun benchmark distant n'a été exécuté.

## Logo et identité
Le tracé SVG original est conservé, fond #5C29D6 ; les PNG 192/512/180 et ICO 16/32/48 sont déclinés à partir de la géométrie originale. Les accents par défaut et le loader utilisent le violet, les préférences de compte existantes restent disponibles. Le contraste de la paire icône est testé ; la conformité globale WCAG et les contrôles sur appareils doivent encore être vérifiés.

## Conversations — contexte transitoire
Deux échanges précédents au maximum, uniquement brouillons non enregistrés et précisions, conservés en mémoire de la page. Le bouton Nouvelle demande, la révocation du consentement ou le changement de session/foyer efface le contexte. La passerelle revalide chaque ancien résultat avec le catalogue actuel avant quota et inférence ; contexte invalide refusé. Aucune écriture, aucune mémoire persistante. Les corrections portent sur le brouillon complet. Tests simulés ; compréhension française réelle encore à mesurer.

## Preview isolée
Page de laboratoire dans preview/assistant : foyer fictif en mémoire, simulateur de commandes à choix limité, identifiée comme non-IA. Elle utilise le validateur et le planificateur réels pour les confirmations locales, ne charge aucun SDK cloud, n'a aucun stockage persistant ni authentification. Les tests ne mesurent ni le modèle ni la synchronisation. La dictée, si autorisée, est gérée par le navigateur.

## Interface et dictée
Trois suggestions en ligne au-dessus de la saisie, pictogrammes à gauche. Le laboratoire conserve les autres scénarios en code. Dictée partagée : transcription intermédiaire, relance bornée, chronomètre, arrêt manuel et sur changement de contexte. Tests navigateur réels à faire. Modèle candidat Gemma 4 26B, GLM 4.7 Flash en alternative configurable (aucun fallback automatique). Secrets renseignés par le propriétaire, non vérifiés ; quota durable et foyer de test restent nécessaires avant activation.

## Quota pilote — code à vérifier en base isolée
- Gemma 4 seulement pendant le pilote : estimation réservée avant appel, taille totale 24 000 octets maximum, 1 400 tokens de sortie maximum, marge 50 %. Les alternatives restent désactivées tant que leur tarification n'est pas validée.
- Compteur quotidien global UTC, proposition de 8 000 neurones estimés et 100 appels maximum. Aucune restitution après échec ou interruption ; échec de réservation bloque l'appel. RPC invoker réservée à service_role, table non exposée avec RLS. Auth utilisateur et adhésion au foyer vérifiées séparément avant réservation.
- [SQL de revue non appliqué](smart-assistant-quota-draft.sql) : avant déploiement, tests Postgres (droits anon/authenticated refusés, service_role autorisé, concurrence, limites, invalides, changement UTC), conseiller sécurité et migration créée via CLI.
- Ce compteur n'est **pas** la facturation Cloudflare : autres usages du compte non mesurés ni surcoûts possibles sur un forfait payant. Activation interdite jusqu'à confirmation explicite Workers Free (`SMART_ASSISTANT_FREE_PLAN_CONFIRMED=true`), secrets disponibles et foyer de test isolé. Vérifier l'usage réel dans le dashboard et la compatibilité du modèle avant benchmark.
- Tarification consultée le 18 novembre 2026 : https://developers.cloudflare.com/workers-ai/platform/pricing/ et https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/.

## Pilote connecté — 18 novembre 2026
Migration `20261117235347_smart_assistant_quota_pilot` appliquée sur le projet autorisé : auto-tests invalides/plafonds, permissions, RLS et zéro réservation résiduelle confirmés. Aucune table budgétaire modifiée. Avis sécurité concernant la table : absence volontaire de politique RLS ; aucun accès utilisateur. La preview `v3.1/live/` utilise une session de test éphémère et le vrai endpoint, sans mutation financière ni calcul des consultations. Les deux drapeaux SMART_ASSISTANT_ENABLED et SMART_ASSISTANT_FREE_PLAN_CONFIRMED doivent être `true` pour permettre un appel. Le compte de test est seul autorisé ; contrôle solo et membership unique. Aucun benchmark réel exécuté. La simulation reste disponible séparément.

## Validation réelle du fournisseur et prochaine intégration
Les logs Supabase du 18/11 montrent plusieurs POST 200 et le compteur 6 réservations pour 917 unités estimées. Les trois fichiers de la fonction hébergée v5 correspondent au commit source f2326dd4. Cela confirme l'appel et la validation des réponses, pas encore la justesse sémantique des 200 cas. Le planificateur prépare désormais la liste des mois à relire et vérifie les récurrences proposées sur tout l'horizon (dates de fin de mois plafonnées), y compris les recouvrements d'un même lot. Avant toute écriture, brancher le moteur de synchronisation existant sur le foyer de test, vérifier que les occurrences sont complètes et que le digest et la session restent stables ; limiter le premier essai à une opération unique. Aucun enregistrement connecté ajouté dans ce commit.

## Proposition immédiate — revue sans écriture
Le modèle propose un lot complet en une requête, défaut acteur/date du jour/ponctuel. Catégorie absente : null et sélection locale, jamais une catégorie inventée. Le contrat de revue est distinct du validateur strict d'écriture. Les variations de budget utilisent planMode et un montant en centimes ; le serveur calcule avant/après à partir des budgets du foyer de test, sans transmettre ces montants au modèle. Le pilote propose des cartes compactes et une confirmation simulée sans second appel IA. Les catégories absentes ou budgets sans baseline ne peuvent pas être confirmés. Aucun enregistrement réel.

## Référentiel de catégorisation et revue V3.1 e
Taxonomie 19 familles dans assistant-core (même code partagé côté serveur), alias de catégories et termes marchands. Priorité à une catégorie explicitement demandée/nom exact, association personnelle du pilote, règle connue, catégorie IA existante ; catégorie connue absente = proposition canonique de création (sans inventer un ID). Les ambiguïtés restent modifiables localement. Le modèle peut fournir un indice parmi les clés contrôlées ; le serveur normalise puis valide le brouillon. Aucun assouplissement du validateur d'écriture. Cartes avec pictogrammes, montants signés, variation nette des opérations uniques, contrôle de catégorie masqué par défaut, Annuler/Confirmer. Création et confirmation simulées, pas de mutation Supabase. Règles personnelles éditables ; stockage navigateur facultatif, limité au foyer test, pas de prompts, montants ou identifiants de session. Synchro de la mémoire et vraie création de catégorie à intégrer plus tard. Cache-busting des ressources du pilote.
