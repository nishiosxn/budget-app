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
