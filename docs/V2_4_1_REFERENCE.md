# Référence historique V2.4.1

Copie du workstate de `develop` au début de la migration du 2 octobre 2026. Les mentions de branche active/prête à fusionner et les validations décrivent l'état antérieur ; pour reprendre, lire le [workstate courant](../workstate.md).

# Workstate — Budget foyer V2.4.1

> Source de vérité pour reprendre le développement sans rescanner le dépôt.

## État final

- Dépôt : `nishiosxn/budget-app`
- Branche active : `v2.4.1`
- Production : `main` → V1
- Tronc V2 : `develop`
- Preview V2.4 : `https://nishiosxn.github.io/budget-app/v2.4/`
- Preview V2.4.1 : `https://nishiosxn.github.io/budget-app/v2.4.1/`
- Projet Supabase : `budget-foyer` (`bqbemjxwdctyovtlpxpm`, `eu-west-1`)
- V2.4 reste le socle cloud/sécurité. V2.4.1 est une évolution UX/UI uniquement, sans modification métier ni Supabase.
- Les changements V2.4.1 portent sur la typographie, le contraste, les tailles fluides, les espacements, les grilles et les très petits écrans.
- Validation utilisateur terminée : UX/UI desktop/mobile, inscription, confirmation email, mot de passe oublié, isolation des foyers, invitation, synchronisation et accès admin testés avec succès.

## Invariants

- Le schéma local V5 reste le format métier et le cache hors ligne.
- Les anciennes clés V2.3 sont migrables sans effacement.
- Les caches V2.4 sont désormais séparés par identifiant de foyer.
- Toutes les données synchronisées portent un `household_id` et sont filtrées par RLS.
- Les suppressions métier synchronisées restent des archives `archived_at`.
- La stratégie de synchronisation reste dernier écrivain gagnant, avec Realtime, file d'attente locale et reprise après reconnexion.
- Seule la clé publishable Supabase est présente dans le navigateur. Aucun secret serveur n'est versionné.


## Couche UX/UI V2.4.1

- Palette : texte principal adouci `#26342d`, texte secondaire renforcé `#56635b`, vert `#23704d`, rouge `#ad5046`.
- Hiérarchie typographique allégée : titres de ligne autour de 650, montants autour de 700, métadonnées autour de 550.
- Les informations secondaires importantes utilisent des tailles fluides avec un plancher proche de 12 px équivalent.
- Les tailles, espacements et montants critiques utilisent `rem` + `clamp()`.
- Les grilles principales utilisent des colonnes flexibles et `minmax(0,1fr)` lorsque nécessaire.
- Un breakpoint très étroit (22 rem) adapte KPI, historique et blocs de surveillance aux formats Fold.
- Les contrôles principaux disposent de cibles tactiles renforcées.
- `prefers-reduced-motion` est respecté.
- Le cache `budget-foyer-v2.4` et le backend V2.4 sont conservés : V2.4.1 ne crée pas un nouveau silo de données.

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

- Interface séparée : `admin/index.html` (`/v2.4.1/admin/` sur la preview V2.4.1).
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

## Réglages Supabase / email

Dans le Dashboard Supabase :

1. `Authentication → URL Configuration` autorise les previews V2.4 et V2.4.1 pour les confirmations, Magic Links et récupérations ;
2. le SMTP personnalisé est activé avec Brevo ; l'expéditeur applicatif est configuré sous le nom **Smart Budget** ;
3. inscription, confirmation d'email et récupération de mot de passe ont été testées avec succès sur V2.4.1 ;
4. **Leaked Password Protection** reste un réglage Auth hébergé optionnel à activer manuellement si le plan le permet.

Le fournisseur Email est actif, les inscriptions sont ouvertes et la confirmation d'email reste requise. Aucun secret SMTP n'est versionné dans le dépôt.

## Validation manuelle

Validation utilisateur terminée sur V2.4.1 :

- création de compte email/mot de passe et confirmation email ;
- récupération et changement du mot de passe ;
- création de foyers indépendants entre comptes ;
- invitation d'un second membre dans un foyer ;
- synchronisation des opérations et comportement multi-session ;
- contrôle d'accès à l'administration ;
- validation visuelle desktop/mobile de la couche UX/UI V2.4.1.

## Workflow Git

- V2.4.1 est validée côté utilisateur et prête pour Pull Request vers `develop`.
- Ne pas fusionner directement dans `main`.
- Laisser **App integrity** valider la PR avant merge vers `develop`.
- La preview reste publiée dans `gh-pages/v2.4.1/` sans modifier `/v2.4/` ni les previews historiques.
