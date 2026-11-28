# Smart Budget V3.1 — Dossier de décision de livraison

Statut au 28 novembre 2026 : **NO-GO pour production**. Travail sur work/v3.1-integration, PR #52 brouillon. Aucun changement hébergé ni publication. Candidat à figer après résultats CI ; d3d747f est la dernière référence application/PostgreSQL vérifiée au relevé, pas un candidat final. Le SHA contenu dans le paquet CI est le checkout réellement testé (un commit de fusion synthétique de PR peut différer de la tête de branche) ; vérifier la correspondance des arbres et figer le SHA final avant publication.

## Périmètre

Smart Assistant : commandes locales, propositions, règles de catégorisation, confirmation atomique, reçus idempotents et contrôle des foyers. Builder : sept étapes, solo/duo, mensualisation, checkpoint privé entre étapes, création transactionnelle. Catégories : répartition, actions groupées et suivi des budgets. Synchronisation, thèmes et PWA conservés.

## Preuves et portes

| Contrôle | Dernière preuve | Décision |
| --- | --- | --- |
| Node et SQL | [46090338537](https://github.com/nishiosxn/budget-app/actions/runs/46090338537), d3d747f, 343/343 et PostgreSQL verts | Acquis pour cette révision, à reconfirmer sur le candidat |
| Rejeu des réponses Gemma | f595303, 5/5, sans nouvelle inférence | Acquis hors ligne ; fournisseur réel après correction non mesuré |
| Coexistence historique | [46089009807](https://github.com/nishiosxn/budget-app/actions/runs/46089009807), [46089273241](https://github.com/nishiosxn/budget-app/actions/runs/46089273241) | Acquis sur b592fcc/80239dd ; candidat à reconfirmer |
| Paquet | 46090338537, 74 fichiers, empreinte e3657d2f0acc9c7b57889d49231b979efb0435d533c8c204a87fb04695d27f67, loopback uniquement | Construction validée, recette exacte en attente |
| Restauration, reprise navigateur, admin | [46090338533](https://github.com/nishiosxn/budget-app/actions/runs/46090338533) en cours | Bloquant tant que résultats non confirmés |
| Audit cible | [rapport](V3_1_HOSTED_PREFLIGHT.md) | Lecture seule acquise ; contrôler à nouveau au moment de l'autorisation |
| Backup réel | 8 tables historiques, sauvegarde réussie au relevé 8D.1 | Couverture objets privés, export hors site et récupération réelle à confirmer |
| iPhone / accessibilité / dictée | Mesures Chromium antérieures, aucun test physique ni VoiceOver complet | Limites à traiter ou accepter explicitement |
| Recette hébergée isolée | Deux projets actifs, aucun troisième projet gratuit confirmé | Ne pas créer, suspendre ou payer sans autorisation |

## Stratégie gratuite recommandée

Terminer la recette CI jetable. Éviter un faux environnement public connecté à la base réelle : Cloudflare Pages gratuit ne fournit pas une base Supabase séparée. Si aucun projet gratuit isolé n'est disponible, préparer un pilote fermé sur le projet Budget existant comme opération de production à autoriser séparément, sans toucher à Nutrition Tracker. Le pilote ne constitue pas une isolation physique. Les tests d'écriture y exigent des comptes et foyers fictifs distincts, une sauvegarde et une revue de sécurité ; aucune donnée personnelle utilisée pour la recette. Le fournisseur IA reste désactivé tant que l'accès gratuit et la mesure après correction ne sont pas validés. Une version déterministe ne doit pas être présentée comme validation de Gemma.

## Séquence conditionnelle

1. CI entièrement verte au SHA final, dossier et empreintes cohérents. Revue des limitations et des droits d'administration. Vérification de l'état actuel de production (SHA frontend, Edge, migrations, garde et sauvegardes) en lecture seule.
2. Autorisation distincte sur la cible, la sauvegarde et la migration additive ; aucune restauration globale, aucune suppression de données. Préparer instantané frais et export chiffré couvrant les objets pertinents. Aucun secret dans les artefacts publics. Si preuve de sauvegarde insuffisante : STOP.
3. Appliquer uniquement les quatre migrations V3.1 absentes, dans l'ordre, sur cible explicitement autorisée. Garder le garde historique ; contrôler les RLS, ACL, contraintes et absence de changement des données existantes. Ne jamais rejouer les migrations historiques divergentes. Les checkpoints ne créent aucune ligne financière ; les saisies non reçues entre étapes restent volatiles.
4. Déployer Edge révisée avec pilotes fermés, vérification JWT et origine autorisée. Ne pas élargir l'accès aux foyers. Conserver le bundle précédent et ses paramètres de restauration sans exposer les secrets. Tester uniquement les comptes fictifs désignés.
5. Préversion immuable à origine distincte si disponible. Si même origine que production, vérifier et isoler stockage, session, caches et périmètre PWA avant tout déploiement ; le sous-chemin seul n'isole pas. Contrôler le paquet réel et son empreinte. Demander autorisation de publication séparée avant mise en ligne.
6. Après recette, décider explicitement de la publication stable. Vérifier la version servie, le chargement, les accès, les reçus, la synchronisation et l'intégrité des données. Aucun déploiement dans le présent lot.

## Arrêt et retour arrière

Au premier échec d'isolation, garde, montant, réception ou intégrité : arrêter le pilote et empêcher les nouvelles écritures de la version. Revenir au client et à l'Edge précédents après revue de compatibilité, conserver les objets additifs et reçus pour réconciliation. Ne pas désactiver les six gardes ni supprimer une table de brouillons. Une restauration financière ciblée nécessite preuve d'écart et autorisation séparée ; ne jamais écraser des écritures légitimes postérieures à la sauvegarde.

## Références

[Checklist](V3_1_RELEASE_CHECKLIST.md) · [Recette connectée](V3_1_CONNECTED_ACCEPTANCE.md) · [Coexistence](V3_1_COEXISTENCE.md) · [Benchmark](V3_1_ASSISTANT_BENCHMARK.md) · [Audit hébergé](V3_1_HOSTED_PREFLIGHT.md) · [Préversion](V3_1_PREVIEW_DEPLOYMENT.md) · [Sauvegarde](BACKUP_RECOVERY.md) · [Export hors site](OFFSITE_BACKUP.md).

Le drill de restauration couvre les schémas applicatifs sur cluster jetable ; Auth/Storage complets, paramètres gérés de supabase_admin et archive externe réelle ne sont pas validés. Aucun jeton, aucune manipulation technique demandés à l'utilisateur.
