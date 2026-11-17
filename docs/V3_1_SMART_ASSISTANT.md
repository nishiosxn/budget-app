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
