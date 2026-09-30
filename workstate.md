# Workstate — Budget foyer V2.4

> Source de vérité pour reprendre le développement sans rescanner le dépôt.

## État final

- Dépôt : `nishiosxn/budget-app`
- Branche active : `v2.4`
- Production : `main` → V1
- Tronc V2 : `develop`
- Preview V2.4 : `https://nishiosxn.github.io/budget-app/v2.4/`
- Projet Supabase : `budget-foyer` (`bqbemjxwdctyovtlpxpm`, `eu-west-1`)
- V2.4 est implémentée côté code, base et Edge Function. La validation automatique passe.
- Le test manuel final avec deux vraies adresses reste à effectuer par le propriétaire.

## Invariants

- Le schéma local V5 reste le format métier et le cache hors ligne.
- Les anciennes clés V2.3 sont migrables sans effacement.
- Les caches V2.4 sont désormais séparés par identifiant de foyer.
- Toutes les données synchronisées portent un `household_id` et sont filtrées par RLS.
- Les suppressions métier synchronisées restent des archives `archived_at`.
- La stratégie de synchronisation reste dernier écrivain gagnant, avec Realtime, file d'attente locale et reprise après reconnexion.
- Seule la clé publishable Supabase est présente dans le navigateur. Aucun secret serveur n'est versionné.

## Authentification

- Email + mot de passe : `signUp` et `signInWithPassword`.
- Confirmation d'email active côté projet (`mailer_autoconfirm=false`).
- Mot de passe oublié : `resetPasswordForEmail`, retour `mode=recovery`, puis `updateUser`.
- Magic Link conservé comme méthode secondaire.
- Une inscription normale sans invitation appelle l'RPC idempotente `ensure_personal_household` et crée un foyer personnel vide.
- Une inscription ouverte depuis une invitation ne crée pas de foyer personnel avant l'acceptation : elle rejoint uniquement le foyer explicitement invité.
- Après déconnexion, l'autorisation de cache hors ligne est retirée.

## Isolation et invitations

- Tables métier : `households`, `household_members`, `categories`, `budgets`, `transactions`, `recurrences`, `household_invites`.
- RLS actif sur toutes les tables publiques.
- Aucun grant direct `anon`.
- Les mutations directes `INSERT/UPDATE/DELETE` de `household_members` sont révoquées pour `authenticated`.
- Le foyer est limité à deux membres par les RPC et par le trigger `household_members_limit_two`.
- Les invitations expirent après sept jours, sont limitées au foyer/slot demandé et consommées atomiquement.
- Le jeton brut n'est jamais stocké : seule sa valeur SHA-256 (`token_hash`) est conservée.
- Les appels sensibles disponibles à `authenticated` contrôlent `auth.uid()`, le rôle propriétaire, le foyer, le slot, l'expiration et la limite de membres.

## Administration globale

- Interface séparée : `admin/index.html` (`/v2.4/admin/` sur la preview).
- Rôle global : `public.app_admins`, RLS actif, aucun grant `anon` ou `authenticated`.
- Journal : `public.admin_audit_log`, également inaccessible aux clients.
- Edge Function : `admin-api`, SDK épinglé, `verify_jwt=true`, origine GitHub Pages/localhost contrôlée.
- Chaque appel valide le JWT côté serveur puis vérifie `app_admins` en base.
- Fonctions : liste des utilisateurs/foyers/membres/dates/états, désactivation/réactivation, suppression d'utilisateur, suppression de foyer.
- `SUPABASE_SERVICE_ROLE_KEY` est lue uniquement depuis l'environnement natif de l'Edge Function.
- L'unique compte existant lors de ce chantier a été désigné premier administrateur côté base ; les inscriptions futures ne deviennent jamais administratrices automatiquement.
- Pour ajouter volontairement un autre admin depuis le SQL Editor : `select private.grant_app_admin_by_email('adresse@example.com');`.

## Architecture utile

```text
index.html
css/style.css
js/
  storage.js              cache V5 isolé par foyer
  auth.js                 password, confirmation, recovery, Magic Link
  cloud-household.js      provisionnement, adhésions, invitations
  cloud-state-core.js
  cloud-load.js
  cloud-save.js
  cloud-realtime.js
admin/
  index.html
  admin.css
  admin.js
supabase/
  functions/admin-api/
  migrations/
scripts/validate.mjs
```

## Migrations appliquées et versionnées

```text
20260930001858_v2_4_household_invites_and_slots.sql
20260930002106_v2_4_sync_fields_and_security_hardening.sql
20260930002728_v2_4_archive_sync_rows.sql
20260930011901_v2_4_multi_user_security_and_admin.sql
20260930012443_v2_4_admin_service_permissions.sql
20260930012820_v2_4_admin_advisor_hardening.sql
20260930012844_v2_4_retire_legacy_household_rpc.sql
```

## Audits

- `node scripts/validate.mjs` couvre les 19 modules, les deux conversions V5/cloud, l'auth complète, le cache par foyer, les invitations hachées, l'admin, la syntaxe Edge, les migrations et l'absence de secret serveur.
- Edge Function sans `Authorization` : HTTP 401 vérifié.
- Test SQL transactionnel avec rôle `authenticated` : foyer propre lisible, foyer/catégorie étrangers invisibles et non modifiables, insertion directe d'un membre refusée ; toutes les données de test ont été annulées par rollback.
- Security Advisor : trois warnings intentionnels pour les RPC `SECURITY DEFINER` exposées uniquement à `authenticated` (`ensure_personal_household`, `create_household_invite`, `accept_household_invite`). Ils sont nécessaires pour des écritures atomiques malgré les grants clients révoqués et valident explicitement l'identité et le périmètre.
- Security Advisor : un réglage Auth hébergé reste manuel, **Leaked Password Protection**. Il n'est pas pilotable par migration SQL.
- Performance Advisor : uniquement des index encore inutilisés sur ce faible volume ; les foreign keys sont toutes indexées.

## Réglages Supabase manuels avant le test email

Dans le Dashboard Supabase :

1. `Authentication → URL Configuration` : autoriser `https://nishiosxn.github.io/budget-app/v2.4/**` pour les confirmations, Magic Links et récupérations ;
2. `Authentication → Sign In / Password Security` : activer **Leaked Password Protection** et fixer la longueur minimale à 8 caractères si le plan le permet.

Le fournisseur Email est actif, les inscriptions sont ouvertes et la confirmation d'email est requise.

## Checklist de test manuel

1. Ouvrir la preview en navigation privée, créer un compte email/mot de passe et confirmer l'email.
2. Vérifier qu'un foyer neuf apparaît, sans donnée du foyer propriétaire.
3. Créer un second compte depuis l'URL publique seule et vérifier qu'il reçoit un autre foyer neuf.
4. Depuis le foyer propriétaire, copier une invitation et l'accepter avec le compte du deuxième membre.
5. Modifier une opération sur deux sessions, tester Realtime puis hors-ligne/reconnexion.
6. Vérifier qu'un compte normal reçoit « Accès refusé » sur `/v2.4/admin/` et que le compte propriétaire voit les écrans admin.
7. Tester mot de passe oublié puis définir le nouveau mot de passe.

## Workflow Git

- Rester sur `v2.4` jusqu'à validation utilisateur.
- Ne pas fusionner dans `develop` ou `main` pendant ce chantier.
- `gh-pages` ne reçoit que le sous-dossier `v2.4/`; les previews V2.0 à V2.3 restent inchangées.
