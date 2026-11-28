# Recette connectée V3.1

La référence d’intégration est `work/v3.1-integration`, PR #52. Les essais CI chargent les migrations versionnées dans une instance Supabase locale et des navigateurs Chromium indépendants. La base historique est représentée par un schéma de contrat synthétique. Les politiques historiques reconstituées et la protection serveur des anciennes versions doivent encore être comparées au schéma hébergé avant mise en service.

## Revue depuis V3.0.2

| Migration | Effet et contrôle de compatibilité |
|---|---|
| `20261117235347` | Compteur pilote UTC isolé. Fonctions quota réservées à `service_role`. |
| `20261121183000`, `20261121194000` | RPC de catégorie et de première dépense atomiques. Autorisation côté Edge et fonctions réservées au service. |
| `20261121195500`, `20261121201000` | Reçus privés à l’API utilisateur, lots atomiques, conservation d’une règle mensuelle reconduite après une exception sur son mois de départ. La seconde migration remplace la RPC de la première. |
| `20261127190000` | Règles personnalisées en lecture sous RLS. Chaque modification vérifie le foyer, la révision et la catégorie cible. |
| `20261127193000` | Mouvements, récurrences, épargne et payeurs solo/duo via RPC de service limitée à la liste exacte du foyer de test. |
| `20261127210000` | Provision du foyer par les règles existantes et brouillon privé, isolé par foyer et propriétaire. Une validation transactionnelle crée catégories et budgets et émet un reçu. L’ancien RPC de provisionnement reste compatible pour ses clients. La nouvelle interface de création dépend de la présence du nouveau RPC. |
| `20261127220000` | Brouillons de confirmation privés, révisions de catégorie et de budget, verrouillage, reçu idempotent et limite d’actions. Backend derrière les drapeaux pilote. |

Les migrations ajoutent des objets ou remplacent des RPC pilote, sans reprise de l’historique financier. Le lot Assistant repose notamment sur les clés stables, les contraintes d’unicité et `updated_at` des catégories et budgets. L’Edge revalide la session avec Auth, vérifie la liste exacte des utilisateurs et du foyer de test, et transmet sa clé de service au serveur uniquement. Les tables et RPC accessibles à un rôle client doivent être confrontés aux privilèges du projet cible. La réponse de prévol de l’Edge conserve l’origine autorisée.

Le client conserve le contrat `x-smart-budget-sync-version: 20261116-hf1` et les gardes locales d’archivage massif. La référence Git ne contient pas les six protections serveur installées le 16 novembre. Leur définition, leur visibilité et leur comportement sous l’ancien en-tête sont des contrôles obligatoires sur une copie de schéma autorisée ou un environnement isolé représentatif. Éviter l’ancien parcours de provisionnement pendant qu’un nouveau foyer possède un brouillon Builder.

## Préparation, déploiement et retour arrière

1. Identifier explicitement la référence du projet cible et le foyer de test. Relever l’état des migrations, les versions Edge, les drapeaux, les contraintes, les politiques, privilèges et triggers. Sauvegarder leurs définitions sans publier d’identifiants, de clés, de brouillons ni de données.
2. Créer un instantané manuel et conserver son identifiant et son heure. Vérifier aussi un export chiffré hors projet avec restauration d’exercice en environnement isolé. L’export actuel couvre les reçus et les règles du schéma `public`, mais les tables privées `private.budget_builder_setup` et `private.smart_assistant_reviews` nécessitent une inclusion explicite si elles contiennent déjà des brouillons à préserver. Voir [Sauvegardes](BACKUP_RECOVERY.md) et [Export hors site](OFFSITE_BACKUP.md).
3. Sur l’instance jetable, charger le schéma de contrat puis appliquer uniquement les migrations absentes, dans l’ordre du journal de migration du projet. Sur un environnement hébergé, attendre l’autorisation, les comptes fictifs isolés et un export de schéma représentatif avant toute application. Ne pas rejouer aveuglément les migrations déjà enregistrées.
4. Après migration, vérifier rôles Auth, ACL des RPC et RLS, ensemble des triggers existants et empreintes du schéma. Déployer la nouvelle Edge et laisser les drapeaux d’écriture désactivés tant que les vérifications de lecture et de compatibilité échouent. Activer ensuite uniquement pour le foyer et les utilisateurs de recette. Cette étape ne requiert pas Gemma.
5. En cas d’anomalie, désactiver l’activation des écritures Assistant et retirer l’accès à la préversion. Revenir au client et à l’Edge précédents, et garder les objets additifs, brouillons et reçus pour réconcilier les demandes en cours. Comparer d’abord le périmètre exact avec l’instantané. Toute restauration financière se fait dans un environnement isolé puis, si nécessaire et séparément autorisé, dans une transaction ciblée sur les identifiants affectés. Une restauration globale effacerait les écritures légitimes postérieures.

La recette CI utilise les services locaux Auth, REST et PostgreSQL. Leurs comptes sont créés pour le test et disparaissent avec le runner. Les résultats de cette recette ne valent pas validation du projet hébergé, de ses triggers ni de ses paramètres de production.

## Résultat de la recette isolée

Quatre scénarios ont réussi sur le commit `d05c655` : Auth et reconnexion, Builder solo/duo et invitation, synchronisation de Catégories et Assistant avec les huit commandes de référence. Un changement de foyer, les budgets concurrents, l’événement Realtime, la reprise des reçus et les refus inter-foyers par API et RPC ont été vérifiés sur ces services locaux. L’historique fictif créé avant migration a conservé toutes ses lignes et leurs valeurs. [CI connectée](https://github.com/nishiosxn/budget-app/actions/runs/46072989316)

Un cinquième scénario a exécuté le Builder duo, Catégories et l’Assistant dans les vraies pages avec le SDK Supabase épinglé. Le navigateur partenaire a vu le remplissage, l’annulation puis une seule dépense après la perte de la réponse Assistant et la récupération du reçu. Les URL des services étaient limitées à l’instance locale de recette. [CI des pages connectées](https://github.com/nishiosxn/budget-app/actions/runs/46076171432)

La comparaison des déclencheurs historiques et la compatibilité serveur des anciennes versions restent à vérifier sur le schéma hébergé. Avant la réception serveur du brouillon Builder, l’avertissement de navigation peut éviter une fermeture involontaire. Une fermeture forcée perd encore la saisie. Le dépôt ne conserve aucun brouillon financier en clair dans le navigateur.

Références Supabase · [CLI local](https://supabase.com/docs/guides/local-development/cli/getting-started), [environnements](https://supabase.com/docs/guides/deployment/managing-environments), [sauvegardes](https://supabase.com/docs/guides/platform/backups).


## 8C.9 — paquet isolé de recette

Le workflow d'intégrité produit `smart-budget-v31-preview` à partir des blobs Git du commit testé. Les trois configurations Supabase sont remplacées par une adresse loopback et une clé de démonstration non fonctionnelle ; aucun accès hébergé, aucun déploiement. Le fichier `preview-source.json` contient les empreintes des fichiers et du paquet. Ce paquet est une étape de préparation : il ne permet pas une connexion Auth réelle tant qu'un environnement isolé et ses paramètres publics n'ont pas été validés. La validation connectée existante reste séparée, sur la vraie pile Supabase jetable.
