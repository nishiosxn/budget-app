# V3.1 — Audit hébergé en lecture seule, 8D.1

Date du relevé : 28 novembre 2026 UTC. Cible historique : budget-foyer, PostgreSQL 17.6, ACTIVE_HEALTHY. Source de travail : b592fcc. Requêtes SELECT de catalogue, métadonnées et agrégat de collision seulement ; aucun contenu financier, identifiant de foyer, secret ou export de lignes collecté. Aucun changement hébergé.

## Schéma et compatibilité

- Journal : 24 migrations, les quatre V3.1 20261127190000, 20261127193000, 20261127210000, 20261127220000 sont absentes. Les versions historiques divergentes déjà identifiées restent à respecter ; ne pas rejouer les anciens fichiers.
- Absence des nouvelles tables private.budget_builder_setup, private.smart_assistant_reviews, private.v31_pilot_builder_users et public.smart_assistant_household_rules.
- RLS activée sur les huit tables financières/de foyer et public.smart_assistant_pilot_batch_receipts ; aucun SELECT anon sur ces neuf tables, ni SELECT authenticated sur les reçus.
- Catégories : nom 1–100 caractères, type income/expense, date de création au premier du mois, owner_slot A/B/null, is_custom non nul, archived_at nullable. Index unique partiel (household_id, legacy_id) si legacy_id non nul. **Zéro collision** des deux identifiants de compatibilité réservés au moment du relevé.
- Budgets : montant >= 0, scope month/forward, date au premier du mois, unique (household_id, category_id, month). Clés étrangères composites de budgets, transactions et récurrences vers catégories : isolation par foyer. Les récurrences imposent start_day 1–31 et end_month >= start_month.
- Les six triggers incident_20261116_maintenance_lock sont actifs sur households, categories, budgets, transactions, recurrences et account_opening_balances. Fonction incident_backup_20261116.freeze_financial_writes, empreinte MD5 e8d74a96d558bb3d0f216d99e08f2e21 ; en-tête exact 20261116-hf1 requis pour authenticated/anon ; code P0001 en cas de refus. Même comportement historique reproduit dans CI. Ne pas désactiver les triggers.
- Edge smart-assistant v30, JWT activé, bundle SHA-256 5228db594a367d3e499d3cd8fdf334c8c149e45dd0759d5871374061d65ebaf5 (inchangé). admin-api v12 JWT activé ; username-signup v9 sans JWT (parcours d'inscription historique, à auditer séparément). Pas de déploiement Edge ni de lecture des secrets.

## Conseiller sécurité Supabase

Aucun constat de niveau ERROR retourné. 4 INFO RLS sans politique (reçus, réservations et deux tables de sauvegarde), 5 WARN : search_path mutable du garde historique, 3 RPC SECURITY DEFINER accessibles à authenticated (invitation, acceptation, provisionnement) et protection des mots de passe divulgués désactivée. Les RPC historiques sont intentionnellement accessibles pour les parcours Auth ; ne pas retirer leurs droits sans validation. Vérifier les contrôles d'identité et de foyer et tester en recette. Le garde historique n'appelle pas d'objet non qualifié hors fonctions PostgreSQL ; le durcissement du search_path doit être évalué séparément sur base jetable, sans modifier la protection existante. La disponibilité de l'option mots de passe divulgués dépend de la configuration/du forfait ; ne pas changer le forfait ou les paramètres Auth sans autorisation.

Références : https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy ; https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable ; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Sauvegardes

- Dernier instantané terminé 2026-11-28 00:17:00 UTC, dernière exécution cron succeeded. Job actif toutes les six heures (17 */6 * * * UTC). 30 jours pour les scheduled ; manual et pre_restore non purgés par la routine.
- Huit tables couvertes : account_opening_balances, budgets, categories, household_invites, household_members, households, recurrences, transactions ; archives incluses. Schémas smart_budget_backups et incident_backup_20261116 non accessibles à anon/authenticated (USAGE et SELECT absents). Fonctions capture_snapshot et compare_snapshot réservées à l'opérateur ; aucune exécution dans cet audit.
- La sauvegarde existante ne couvre ni les reçus Assistant historiques, ni les réservations, ni les futurs brouillons Builder/Assistant, ni les règles personnalisées. La documentation de l'export hors site décrit un dump de public, smart_budget_backups, incident_backup_20261116 ; l'état réel de ses secrets, de son dernier export et de sa clé de récupération n'a pas été vérifié. Ne pas présumer que l'export est actif ou restaurable.
- Prochaine recette : reproduire sur la pile jetable le schéma V3.1, créer des brouillons staged, reviews et reçus fictifs, exporter les schémas nécessaires en format PostgreSQL, chiffrer avec une clé éphémère de recette, restaurer dans une autre base jetable puis comparer lignes, ACL, contraintes, reçus et isolation. Ne jamais publier le dump clair ni une clé de production. Aucun export financier réel nécessaire à ce test.
- Avant une migration hébergée autorisée : confirmer sauvegarde récente et couverture hors projet, inclure explicitement private et smart_assistant_private ainsi que les dépendances Auth nécessaires, distinguer sauvegarde financière et reprise complète de projet. Préparer retour arrière par désactivation pilote et retour client/Edge, conserver les reçus et les données additives. Jamais de restauration globale par défaut.

## Portes de livraison

CI b592fcc : application et PostgreSQL verts (46089009818) ; recette connectée 46089009807 en cours au relevé. Les contrôles avant/après migration historique et les scénarios connectés ont réussi ; les tests UI de coexistence et PWA restent à confirmer. Paquet 40b35e6 validé en CI, configuré loopback uniquement. Aucun projet de recette hébergé isolé n'est confirmé. Aucun projet à créer, suspendre, facturer ou migrer dans ce lot. Le projet Budget n'est pas un environnement jetable. Aucun nouvel appel Gemma ; rejeu hors ligne déjà validé.


## 8D.2 — recette de restauration automatisée

CI b592fcc 46089009807 terminée avec succès (coexistence historique incluse). Une recette de sauvegarde applicative chiffrée a été ajoutée : pile locale Supabase, données fictives, création de brouillon Builder et revue Assistant préparée, reçu exécuté, règle et quota, capture historique ; pg_dump custom des cinq schémas applicatifs puis age en flux, restauration dans une base distincte du même cluster jetable, empreintes des lignes/contraintes/politiques/triggers et droits, vérification des RPC et rejeu idempotent du reçu. La clé age et l'archive sont éphémères, aucun artefact de sauvegarde publié. Auth est reconstitué par des identités fictives minimales : ce n'est pas un test de restauration complète Auth/Storage, ni de récupération d'une archive de production. CI de cette nouvelle recette à confirmer. Aucun accès à une base hébergée.
