# Smart Assistant V3.1 · Benchmark du lot 6

Mesure du 27 novembre 2026 sur 208 commandes fictives. Le corpus comporte dix variantes de chacune des vingt intentions historiques et huit cas annotés supplémentaires. Il inclut des formulations familières, des variantes d’enseigne, des catégories absentes, des dates, des récurrences, des demandes composées et des refus. Les variantes d’une même intention sont corrélées. Les pourcentages décrivent ce corpus, sans estimation du trafic réel.

```sh
node scripts/assistant-benchmark.mjs --local --compare=6530f28
```

`6530f28` est le commit local correspondant à la référence GitHub `376ff27`. Dans un clone GitHub, utiliser `--compare=376ff27`. Les propositions sont comparées action par action selon leur type, leur catégorie, leur payeur, le montant en centimes, la date, la fréquence, le mode budgétaire et les libellés annotés. Le contrôle des libellés exacts porte sur les huit cas ajoutés. Les consultations sont comparées selon le type, le mois et les filtres. Une clarification réussit si elle est proposée à la place d’une opération.

| Indicateur | Avant | Après |
|---|---:|---:|
| Propositions locales exactes, ensemble du corpus | 20/208 · 9,6 % | 55/208 · 26,4 % |
| Demandes traitées sans IA | 24/208 · 11,5 % | 55/208 · 26,4 % |
| Justesse parmi les résultats locaux | 20/24 · 83,3 % | 55/55 · 100 % |
| Latence moyenne de l’analyse locale, exécution Windows Node | 0,365 ms | 0,194 ms |
| Taille UTF-8 du prompt système | 4 702 octets | 1 474 octets |
| Taille moyenne de la requête si envoyée au fournisseur | 7 142 octets | 3 907 octets |
| Neurones estimés à réserver, moyenne / maximum sur les cas orientés vers le fournisseur | 167,86 / 168 | 123,71 / 124 |

La latence exclut l’authentification, le réseau et les lectures de budgets. Elle dépend du démarrage et de l’optimisation de Node. Aucune requête fournisseur n’est émise par la mesure locale. Les estimations utilisent la taille UTF-8, une marge de 50 %, une réserve de 2 048 unités d’entrée estimée et le plafond de 1 024 tokens de sortie. Le plafond applicatif reste de 320 neurones estimés par appel et de 8 000 unités réservées ou 100 demandes par jour UTC.

**Limites locales observées.** 153 commandes restent orientées vers la voie fournisseur ou la reformulation en mode local. Il reste 86 brouillons, 35 consultations et 32 clarifications attendues hors couverture déterministe. Les comparaisons générales, les filtres de transactions sur plusieurs périodes, certaines formulations de payeur et les demandes mêlant plusieurs dates ou conditions restent les points de couverture les plus faibles. Les huit commandes de référence du lot 4 gardent leur traitement local.

## Gemma et quota gratuit

Cloudflare liste `@cf/google/gemma-4-26b-a4b-it` sans l’inclure parmi les modèles imposant un moyen de paiement. Workers Free offre 10 000 neurones quotidiens pour le compte, renouvelés à minuit UTC. Au-delà, les requêtes sont refusées sur Workers Free. Sur Workers Paid, l’excédent peut être facturé au tarif publié. Gemma utilise 9 091 neurones par million de tokens d’entrée et 27 273 par million de tokens de sortie. [Modèle](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/) · [Tarifs et quotas](https://developers.cloudflare.com/workers-ai/platform/pricing/) · [Inscription Workers sans carte](https://www.cloudflare.com/products/workers/)

| Mesure fournisseur réelle | Résultat |
|---|---|
| Appels effectivement exécutés | 0 |
| Réussite de l’interprétation financière | Non mesurée |
| Tokens d’entrée/sortie, moyenne et maximum | Non mesurés |
| Neurones réellement imputés au compte | Non mesurés |
| Latence moyenne | Non mesurée |

L’environnement ne dispose ni d’accès au tableau de bord du compte de test ni du jeton Workers AI. La disponibilité sur ce compte, le forfait exact et son quota restant demeurent à confirmer. Le modèle est conservé. L’essai réel se fait avec un compte de test Workers Free vérifié sans moyen de paiement requis, hors crédits prépayés, et avec un jeton autorisé pour Workers AI. Le runner `--live` reste inactif sans vérification explicite du forfait. Il accepte au plus 10 commandes fictives par lot et 2 000 neurones de réserve estimée, sans relance automatique. Il rapporte les tokens communiqués et l’interprétation par cas. La mesure de neurones réels se relève séparément dans le tableau de bord sur le créneau du test. Les identifiants restent dans l’environnement d’exécution hors dépôt.

## Comportement vérifié par tests

Le moteur local précède la réservation et reste utilisable lors d’une panne fournisseur. Un quota épuisé, un délai dépassé, une réponse tronquée ou invalide et une erreur réseau sont distingués. Deux demandes identiques simultanées partagent l’appel en cours uniquement dans la même instance et pour le même utilisateur et foyer. L’édition, l’annulation et la confirmation restent sur leurs voies existantes. Les tests d’erreur utilisent des réponses contrôlées et ne mesurent pas le fournisseur.
