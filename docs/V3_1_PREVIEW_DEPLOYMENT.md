# V3.1 — Préversion connectée : configuration et portes de déploiement

## Décision 8D.3

Relevé du 28 novembre 2026 : la connexion Supabase Budget ne présente qu'un projet actif, budget-foyer (production). Aucun projet de recette hébergé distinct n'est confirmé. La recette connectée continue exclusivement sur la pile Supabase CLI éphémère. Aucun nouveau projet, aucune suspension, aucun changement de forfait, aucune modification hébergée. Aucun secret demandé à l'utilisateur.

La coexistence est verte sur b592fcc et 80239dd (46089009807 et 46089273241). CI bc759c4 : application/PostgreSQL verts, exercice de restauration chiffrée en attente au relevé. Il est interdit de considérer la restauration comme validée avant son résultat.

## Paquet de recette

Le générateur prepare-v31-preview.mjs lit les blobs suivis du SHA exact, refuse les références Supabase hébergées et remplace les trois configurations par loopback/clé fictive. La recette additionnelle reconstruit le paquet du SHA de CI, vérifie toutes les empreintes déclarées, ouvre les ressources réellement empaquetées dans Chromium, puis confirme une dépense déterministe avec le véritable Edge local. Elle vérifie l'absence d'écriture avant confirmation, la ligne sauvegardée, l'isolation d'un autre foyer et le refus admin. Le proxy de test conserve toutes les requêtes navigateur sur loopback, remplace uniquement les trois configurations par les valeurs de la pile jetable et route Edge localement. Ce n'est pas un test de CORS hébergé ni une mise en ligne.

## Contrat d'isolation hébergée (non configuré)

| Élément | Condition |
| --- | --- |
| Base | Projet distinct explicitement identifié comme recette, jamais budget-foyer ou Nutrition Tracker. Données 100 % fictives. |
| Frontend | Origine HTTPS dédiée distincte de celle de production ; un simple sous-dossier GitHub Pages ne sépare pas localStorage/CacheStorage. |
| Paquet | SHA revu, empreintes, trois configurations publiques réécrites uniquement dans une copie. Refuser toute référence à un projet réel non autorisé. |
| Auth | URL du site et redirections exactes de recette, comptes fictifs, aucune réutilisation de compte réel. Pas de wildcard ni de clé serveur dans le navigateur. |
| CORS | Origine exacte de recette pour smart-assistant et admin-api ; rejeter l'origine réelle, les origines tierces et null côté recette. Tester les préflights et les requêtes authentifiées sans proxy qui retire Origin. |
| Assistant | JWT vérifié, pilotage désactivé par défaut, liste explicite d'un foyer fictif et de ses 1–2 acteurs. Gemma désactivé (SMART_ASSISTANT_FREE_PLAN_CONFIRMED=false, aucun credential fournisseur). |
| Builder/règles | Listes pilotes privées vides par défaut ; seulement comptes/foyers fictifs approuvés. Aucun droit client d'inscription dans les listes. |
| Admin | JWT vérifié, compte fictif spécifiquement désigné, contrôle d'autorisation serveur ; aucun service_role dans les ressources frontend. |
| PWA | Manifeste/worker relatifs ; origine distincte pour éviter la purge de caches de production. Vérifier installation, rechargement, mise à jour et stockage. |

Si aucune cible gratuite et isolée n'est disponible, ne pas connecter un frontend public au projet réel pour contourner ce manque. Une éventuelle recette pilote hébergée sur la base de production constitue un autre scénario à examiner et autoriser séparément, avec garde d'isolation et sauvegarde. Ne jamais ouvrir les fonctionnalités à tous les foyers par défaut.

## Ordre de déploiement proposé — uniquement après autorisation

1. Figer SHA et CI entièrement verte, y compris restauration et test du paquet. Fermer ou accepter explicitement les limites restantes (Auth/Storage, archive externe réelle, Gemma, iPhone et accessibilité, brouillon initial et administration). Vérifier une sauvegarde fraîche et la couverture des objets privés.
2. Confirmer cible et origine isolées, coûts et capacité. Audit du schéma et des protections, collisions et versions historiques. Ne pas rejouer les migrations déjà appliquées.
3. Préparer les quatre migrations nouvelles dans l'ordre, sur la cible isolée seulement ; contrôler RLS, droits, triggers et comptage des objets après chaque étape. Sauvegarder l'état initial, conserver les gardes historiques.
4. Préparer les fonctions serveur et variables uniquement côté serveur sur cette cible ; vérifier JWT, origines, refus multi-foyers, listes pilotes et désactivation du fournisseur. Revue distincte du backend.
5. Construire le paquet immuable et vérifier qu'il ne contient que des valeurs publiques de recette. Tester liens, ressources, CORS/Auth, stockage et PWA sur l'origine de recette. Revue distincte de publication frontend.
6. Autorisation explicite sur la cible et le paquet, publication limitée à la recette ; vérifier URL réellement servie et exécuter tests de bout en bout. Ne pas modifier main, gh-pages ou Edge de production sans décision distincte.
7. Retour arrière : fermer les pilotes/Edge recette, revenir au SHA précédent de la recette, conserver les reçus et réconcilier les confirmations ; pas de suppression globale ni de restauration aveugle.

Aucun point de cette procédure hébergée n'est exécuté dans 8D.3. Les tests locaux restent autonomes, aucune commande ni jeton utilisateur.
