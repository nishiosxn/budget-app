# Smart Budget — Sauvegardes privées et récupération

## Statut (16 novembre 2026)

- Supabase : projet `budget-foyer`.
- Sauvegardes dans **`smart_budget_backups`**, schéma privé non exposé à l'API.
- Table `snapshots` (ID, date, motif, fin) et table `snapshot_tables` (table, nombre, contenu JSONB intégral).
- 8 tables sauvegardées **en une lecture cohérente MVCC** : `households`, `household_members`, `household_invites`, `categories`, `budgets`, `transactions`, `recurrences`, `account_opening_balances`.
- Les lignes archivées sont **incluses**. Les valeurs, identifiants et horodatages sont préservés dans les documents de sauvegarde.
- Planification : `cron.job` `smart-budget-financial-snapshot-every-6h`, `17 */6 * * *` (UTC), soit toutes les six heures, minute 17.
- Conservation : **30 jours** des instantanés `scheduled` ; les instantanés `manual` et `pre_restore` ne sont pas purgés par cette tâche. Les copies `incident_backup_20261116` restent séparées et intactes.
- Aucune écriture dans les tables métier, aucun changement à l'en-tête client `x-smart-budget-sync-version`, aucune modification des triggers de protection.
- La tâche est exécutée par la base avec le rôle PostgreSQL `postgres`. Les rôles `anon`, `authenticated` et `service_role` n'ont ni usage du schéma ni droit d'exécuter les fonctions.

## Consulter les sauvegardes (opérateur Supabase seulement)

Dans l'éditeur SQL du projet connecté avec un rôle administrateur :

```sql
select s.id, s.captured_at, s.reason, s.completed_at,
       count(st.source_table) as tables,
       sum(st.row_count) as rows_backed_up
from smart_budget_backups.snapshots s
join smart_budget_backups.snapshot_tables st on st.snapshot_id=s.id
group by s.id, s.captured_at, s.reason, s.completed_at
order by s.id desc;
```

Pour **prévisualiser les écarts sans modifier les données** (remplacer `1` par l'ID choisi) :

```sql
select * from smart_budget_backups.compare_snapshot(1);
```

Les résultats `added_since`, `missing_since` et `changed_since` comparent chaque ligne à partir de sa clé primaire ou clé composite. Les changements des champs techniques `updated_at` sont également signalés : ils ne prouvent pas à eux seuls une perte de données.

Pour vérifier le planificateur et les derniers déclenchements :

```sql
select jobid, jobname, schedule, username, active
from cron.job
where jobname='smart-budget-financial-snapshot-every-6h';

select status, return_message, start_time, end_time
from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='smart-budget-financial-snapshot-every-6h')
order by start_time desc limit 10;
```

Si le dernier instantané date de plus de six heures en condition normale, examiner les erreurs du planificateur avant toute opération de restauration.

## Plan de récupération (jamais automatique)

1. Fermer les clients problématiques et déterminer **exactement** le foyer, les tables, les catégories et les opérations impactées. Ne pas transformer un problème d'affichage en suppression massive.
2. Identifier un instantané antérieur à l'incident. Consulter `compare_snapshot(id)` et les documents JSON concernés. Comparer les valeurs et les champs archivés ligne par ligne.
3. Avant une éventuelle correction, enregistrer **une nouvelle copie de l'état présent** :

   ```sql
   select smart_budget_backups.capture_snapshot('pre_restore');
   ```

4. Préparer une transaction SQL ciblée avec contrôle explicite des IDs et du `household_id` ; vérifier les montants, les archives, les clés étrangères et les lignes modifiées, en particulier les modifications légitimes survenues après la sauvegarde.
5. **Ne pas exécuter de restauration globale par défaut.** Une réimportation aveugle effacerait les nouvelles opérations légitimes et pourrait rompre la synchronisation. La restauration ciblée doit être d'abord simulée dans une transaction `BEGIN ... ROLLBACK`, puis validée explicitement avant `COMMIT`.
6. Après intervention autorisée, comparer l'état restauré, vérifier les comptes et tester la synchronisation du client corrigé. Conserver l'instantané `pre_restore` pour un retour arrière.

Le contenu d'une table sauvegardée peut être inspecté **en lecture seule** :

```sql
select source_table, row_count, rows
from smart_budget_backups.snapshot_tables
where snapshot_id=1 and source_table='transactions';
```

Ces données contiennent des informations financières et des métadonnées sensibles : ne jamais publier le résultat SQL dans GitHub ni l'exposer par une route publique ou une fonction RPC accessible au navigateur.

## Limites et prochaine étape

**Ces instantanés sont enregistrés dans la même base Supabase**. Ils protègent principalement contre une modification ou un archivage accidentel au sein de l'application. Ils ne protègent pas contre la suppression du projet, une panne totale du stockage ou un accès administrateur malveillant. Pour une véritable reprise après sinistre, ajouter des exports chiffrés hors projet ou une solution native de sauvegarde/PITR adaptée au forfait.

L'interface Smart Budget ne comporte volontairement **aucun bouton de restauration**. Un mécanisme de récupération automatique côté client serait dangereux tant que les changements multi-appareils et les droits d'administration n'ont pas été audités.


## Relevé 8D.1 — 28 novembre 2026

Dernière sauvegarde automatique réussie à 00:17 UTC, job actif toutes les six heures, huit tables. Les futurs objets V3.1, reçus et réservations Assistant ne font pas partie de cette capture. Aucun nouvel instantané créé par l'audit. Voir [audit hébergé](V3_1_HOSTED_PREFLIGHT.md) pour la recette de sauvegarde/restauration isolée et les conditions de livraison.
