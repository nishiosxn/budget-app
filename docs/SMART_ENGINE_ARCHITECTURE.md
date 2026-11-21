# Smart Engine — fonctionnement et intégration dans Smart Budget

État : lot 31ap, fonction pilote Supabase **smart-assistant v30** mise à jour le 22 novembre 2026, JWT conservé. Source du moteur alignée avec le navigateur 31ap. **Aucun schéma SQL ni contenu financier modifié**, aucune publication Smart Budget principale.

## Ce qu'est Smart Engine

Smart Engine est un **parseur déterministe JavaScript**, pas un modèle d'IA entraîné. Il ne possède pas de base de données de phrases apprises. Les règles linguistiques, expressions régulières, formats de montant, dates, catégories canoniques (19 familles) et alias métier sont déclarés dans `js/assistant-core.js`. La même implémentation est copiée à l'identique dans `supabase/functions/_shared/smart-assistant-core.js` pour le serveur.

Le contexte réel du foyer (catégories, propriétaires autorisés, dates) est lu sous contrôle d'authentification et de droits dans Supabase. Ces données **ne sont pas** des règles d'entraînement. Les associations « enseigne/mot-clé → catégorie » enregistrées volontairement par l'utilisateur sont conservées localement dans son navigateur par le pilote ; elles ne constituent pas un apprentissage statistique autonome.

## Chemin de traitement

1. Le navigateur envoie la demande au pilote Edge `smart-assistant` par HTTPS avec un JWT utilisateur ; la commande n'écrit rien.
2. La fonction Edge vérifie JWT, utilisateur, appartenance au foyer et liste autorisée de test. Elle reconstitue un contexte limité à partir des catégories du foyer.
3. `quickCommand()` normalise les apostrophes et les montants dits en français, puis essaie des expressions **complètes et délimitées** : dépenses, revenus, épargne, budgets, création de catégories explicitement demandée, requêtes et lots.
4. Les propositions passent par les validations de schéma, de centimes, de dates, d'identité des payeurs, de catégorie et de récurrence. Un lot dont une clause est inconnue n'est pas converti partiellement par le moteur local.
5. Si le résultat local est fiable, la passerelle renvoie `model: "local-rules"` et `0 token IA / 0 neurone réservé`. Une projection budgétaire peut nécessiter des lectures serveur, mais pas d'IA.
6. Sinon, **seulement après autorisation et réservation de quota**, la passerelle peut soumettre un contexte borné à Cloudflare AI (Gemma 4). Sa réponse est revalidée. L'appel IA n'autorise aucune écriture à lui seul.
7. L'utilisateur inspecte et peut modifier la proposition. L'enregistrement est une action séparée avec `requestId`, contrôles serveur, autorisations RLS et opérations atomiques/idempotentes pour les types déjà pris en charge dans le pilote. Les autres types restent explicitement simulés.

### Règle absolue

Reconnaître une expression **ne vaut pas autorisation d'exécuter**. Ne jamais déduire un membre payeur, un solde bancaire, un compte cible ou une nouvelle catégorie de manière implicite. Ne jamais supprimer une partie incomprise d'une phrase pour proposer le reste comme si tout avait réussi.

## Lot 31ap — enrichissement du français quotidien

- Sujets omis dans les phrases composées : `J'ai dépensé 20 euros chez McDo et reçu 10 euros de Lena`.
- Variations `recu / reçu / touché / encaissé / perçu / récupéré / gagné`, et revenus attribués : `Léna m'a viré / envoyé / remboursé 10 euros`, `je viens de recevoir…`.
- Achats : `j'ai réglé…`, `j'ai effectué un achat de…`, `j'ai acheté pour…`, `20 euros chez…`, `20 euros de courses chez…`.
- Relais `et`, `puis`, `ensuite`, virgule et point-virgule, nombres prononcés, centimes et opérations multiples.
- Budgets : `augmente mon budget…`, `ajoute 10 euros à mon budget…`, `remets mon budget à zéro`.
- Épargne : `sur mon livret A`, `dans mon épargne`.
- Sécurité : distinction commerçant connu / bénéficiaire inconnu, refus des commandes de suppression mélangées, des montants négatifs, des dates qui risquent de ne s'appliquer qu'à une partie du lot, des récurrences non explicites et des résultats partiels.
- Les fichiers client/serveur et les tests ont été mis à jour conjointement. Déploiement isolé du backend pilote v30, puis des seules ressources navigateur `v3.1/js/assistant-core.js` et `v3.1/live/index.html` sur GitHub Pages (commit `17ca4dd`). La CI source `44962165968` est passée ; le test authentifié en navigateur reste à effectuer.

## Limites

Un parseur déterministe ne peut pas couvrir « toutes les phrases possibles » sans risques. Pour des demandes ambigües, longues, conditionnelles ou comportant des références à un état externe, conserver le repli IA ou demander une précision. Les nouvelles expressions doivent être ajoutées avec des tests positifs de montant/catégorie/date/propriétaire **et** des tests négatifs de non-exécution partielle.

## Axe V3.1 → intégration Smart Budget

1. **Stabiliser le pilote** : essais réels sur navigateur authentifié, revue des coûts IA évités, tests manuels d'écriture uniquement dans un foyer de test, reprise après timeout, audit de contraste/zoom/iOS.
2. **Brancher à l'application existante** : module Smart Assistant réutilisant le design system, la session Supabase, le foyer sélectionné, la navigation mobile et les calculs budgétaires de Smart Budget ; ne pas dupliquer les sources de vérité.
3. **Contrat d'actions commun** : séparer lecture, proposition, correction et confirmation ; tous les types (revenu, dépense, budget, catégorie, récurrence, épargne et lots) doivent avoir un statut de support explicite, un validateur serveur et un retour d'historique/synchronisation fiable.
4. **Foyers à deux** : ne pas retirer la restriction solo/allowlist du pilote par simple modification visuelle. Vérifier l'identité des deux membres, leurs propriétaires autorisés, RLS et la notion de compte/épargne avant toute extension.
5. **Recette et diffusion** : scénarios de langage réel, tests unitaires et intégration, desktop/iOS, mode clair/sombre, connectivité interrompue, double clic, anti-doublons et conflits sync ; activer d'abord pour un foyer de test puis valider explicitement la production.

Aucune fusion vers `develop` ou `main` et aucun déploiement de production sans validation de la recette.