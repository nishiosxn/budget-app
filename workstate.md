# Workstate — Budget foyer

> Source de vérité pour reprendre le développement sans rescanner le dépôt.

## 1. État actuel

- Dépôt : `nishiosxn/budget-app`
- Production : `main` → V1
- Tronc V2 : `develop`
- Branche active : `v2.4`
- Dernier jalon publié : V2.3
- Objectif V2.4 : authentification Magic Link, foyer partagé Supabase, synchronisation Realtime et cache local hors ligne.
- Projet Supabase : `budget-foyer` (`bqbemjxwdctyovtlpxpm`, région `eu-west-1`)
- État au 30 septembre 2026 : implémentation V2.4 terminée et audit statique/visuel réussi ; test bout en bout avec deux vrais comptes encore à faire.

## 2. Invariants à préserver

- Le schéma local V5 reste le format métier de l’application et le cache hors ligne.
- Aucune transaction, aucun budget réel, aucun prénom personnel et aucun secret serveur ne sont stockés dans Git.
- La clé Supabase du navigateur est une clé publique publishable ; ne jamais ajouter de clé `service_role`.
- Chaque donnée cloud appartient à un foyer et toutes les tables exposées utilisent RLS.
- Les suppressions synchronisées sont des archives (`archived_at`) afin de ne pas ressusciter des lignes sur un autre appareil.
- La V2.4 applique une stratégie dernier écrivain gagnant. La détection/résolution fine des conflits reste prévue pour V2.5.
- Les anciennes clés V2.3 sont copiées vers V2.4 sans être effacées.

## 3. Architecture V2.4

```text
index.html
css/style.css
js/
  config.js
  data.js
  storage.js
  calculations.js
  ui.js
  categories.js
  transactions.js
  settings.js
  tracking.js
  onboarding.js
  supabase-config.js
  supabase-client.js
  auth.js
  cloud-household.js
  cloud-state-core.js
  cloud-load.js
  cloud-save.js
  cloud-realtime.js
  app.js
supabase/migrations/
scripts/validate.mjs
```

Ordre de chargement : moteur local V5, SDK Supabase épinglé, modules cloud, puis `app.js`.

## 4. Stockage et synchronisation

- Cache actif : `budget-foyer-v2.4`.
- Sources locales reprises automatiquement : `budget-foyer-v2.3`, puis `budget-foyer-v2.3-preview`.
- L’écran de connexion protège le cloud, mais un cache V5 existant reste utilisable si le SDK ou le réseau est indisponible.
- Toute sauvegarde locale déclenche une synchronisation différée de 650 ms.
- Une écriture cloud utilise un snapshot immuable de l’état local ; une modification arrivée pendant l’envoi reste marquée en attente.
- Les catégories, budgets, transactions et récurrences sont insérés ou mis à jour avec les seules colonnes autorisées par les grants Supabase.
- Les catégories et lignes absentes du snapshot sont archivées.
- Realtime recharge l’état du foyer lorsqu’aucune modification locale n’est en attente ; sinon la modification locale est envoyée en priorité.
- `selectedMonth` reste une préférence locale et n’est pas synchronisé.

## 5. Authentification et foyer

- Connexion par Magic Link Supabase, sans mot de passe dans l’application.
- Création d’un foyer avec attribution du propriétaire au slot `B`.
- Import facultatif de l’état V5 local lors de la création du premier foyer.
- Invitation UUID valable sept jours pour le deuxième slot du foyer.
- Acceptation atomique via RPC avec verrou de ligne et contrôle du slot.
- Déconnexion, affichage du compte actif et copie du lien d’invitation depuis les paramètres.
- Le callback `onAuthStateChange` reste synchrone ; le bootstrap asynchrone est planifié hors du callback pour éviter les blocages du client Supabase.

## 6. Supabase actuel

Tables publiques :

- `households`
- `household_members`
- `categories`
- `budgets`
- `transactions`
- `recurrences`
- `household_invites`

État vérifié :

- RLS actif sur les sept tables ;
- aucune ligne de données au moment de l’audit ;
- Realtime actif sur les six tables synchronisées (invitations exclues) ;
- accès `anon` direct refusé ;
- policies limitées aux membres/propriétaires du foyer ;
- fonctions RPC avec `search_path` vide et vérification explicite de `auth.uid()` ;
- migrations V2.4 versionnées dans `supabase/migrations/`.

Les trois alertes Security Advisor restantes concernent volontairement les RPC `SECURITY DEFINER` accessibles aux utilisateurs authentifiés : `create_household`, `create_household_invite` et `accept_household_invite`. Elles constituent l’API publique prévue et vérifient authentification, rôle, foyer et slot. Les alertes Performance Advisor sont uniquement des index encore inutilisés car la base est vide.

## 7. Plan V2.4

### Phase A — base et sécurité

- [x] Configurer le projet et la clé publishable navigateur.
- [x] Activer RLS et les policies par foyer.
- [x] Ajouter slots, invitations et RPC sécurisées.
- [x] Ajouter les champs de synchronisation V5 et les archives.
- [x] Activer Realtime sur les tables synchronisées.
- [x] Versionner les trois migrations V2.4 appliquées.

### Phase B — authentification et foyer

- [x] Ajouter le client Supabase épinglé.
- [x] Ajouter le Magic Link.
- [x] Ajouter création du foyer et import local facultatif.
- [x] Ajouter invitation et acceptation du deuxième membre.
- [x] Ajouter le panneau compte/foyer et la déconnexion.
- [x] Préserver l’usage local si le cloud est indisponible et qu’un cache existe.

### Phase C — synchronisation

- [x] Convertir Supabase vers l’état local V5.
- [x] Convertir l’état local V5 vers Supabase.
- [x] Synchroniser catégories, budgets, transactions et récurrences.
- [x] Archiver les suppressions.
- [x] Gérer les modifications survenues pendant un envoi.
- [x] Ajouter Realtime et la reprise après reconnexion.

### Phase D — validation et publication

- [x] Vérifier la syntaxe des 19 modules JavaScript.
- [x] Vérifier IDs, références DOM et ordre des scripts.
- [x] Tester automatiquement la conversion cloud → V5.
- [x] Vérifier le SDK épinglé, la clé V2.4 et les migrations présentes.
- [x] Vérifier l’écran de connexion en mobile et en bureau.
- [x] Vérifier l’absence d’erreurs navigateur au chargement.
- [x] Refaire les audits Security et Performance Advisor.
- [ ] Tester le parcours réel avec deux adresses : Magic Link, création/import, invitation, modification sur deux sessions et reconnexion hors ligne.
- [ ] Créer la Pull Request `v2.4 → develop` après ce test utilisateur.
- [ ] Publier la preview V2.4 sur `gh-pages` après validation.

## 8. Validation effectuée

Commande :

```text
node scripts/validate.mjs
```

Résultat : audit automatique réussi, incluant 19 modules, état V5 neutre, formules métier, migration legacy, conversions cloud dans les deux sens, modules cloud, SDK épinglé, cache isolé et migrations Supabase.

Contrôle navigateur local :

- écran Magic Link visible et accessible ;
- panneau mobile contenu dans 390 px sans débordement horizontal ;
- panneau bureau calculé à 520 px et centré ;
- aucun message d’erreur ou avertissement dans la console ;
- tous les scripts locaux et le SDK Supabase référencés dans le bon ordre.

Limite : aucun email n’a été envoyé pendant l’audit. Le test authentifié exige une adresse contrôlée par l’utilisateur.

## 9. Migrations versionnées

```text
20260930001858_v2_4_household_invites_and_slots.sql
20260930002106_v2_4_sync_fields_and_security_hardening.sql
20260930002728_v2_4_archive_sync_rows.sql
```

Ces fichiers représentent les deltas V2.4 déjà appliqués au projet Supabase existant. Le schéma de base avait été provisionné avant leur suivi dans le dépôt.

## 10. Reprise de travail

1. lire ce fichier ;
2. vérifier `git status` sur `v2.4` ;
3. lancer `node scripts/validate.mjs` ;
4. effectuer le test utilisateur Magic Link à deux comptes ;
5. corriger uniquement si ce test révèle un écart ;
6. ouvrir la PR `v2.4 → develop`, puis publier la preview après validation.

## 11. Workflow Git

```text
main       → production stable V1
develop    → tronc V2
v2.4       → jalon cloud actif
gh-pages   → publication et previews
```

Le check GitHub Actions **App integrity** s’exécute sur les Pull Requests vers `develop` et `main`.

## 12. Maintenance dépôt encore indépendante de V2.4

- [ ] Basculer GitHub Pages de `main /(root)` vers `gh-pages /(root)`.
- [ ] Après bascule Pages, retirer les dossiers de previews de `main`.
- [ ] Créer les tags de jalon V2.0 / V2.1 / V2.2 / V2.3.
- [ ] Supprimer les branches temporaires déjà fusionnées.
- [ ] Rendre le check `App integrity` obligatoire sur `main` et idéalement `develop`.
