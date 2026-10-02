# Changelog

## Maintenance — workflow hybride

- Branches permanentes `main`, `develop`, `gh-pages` ; nouveaux lots sur `work/vX.Y-<lot>` avec Draft PR vers `develop` et nettoyage après merge.
- Tags immuables pour les jalons validés, après décision explicite ; aucune création ni modification de tag pendant cette migration.
- Guide Codex/Work, méthode dédiée et audit des branches historiques conservées pour revue future.
- Workstate simplifié, ancienne référence V2.4.1 conservée et README aligné sur le socle de `develop`.
- Contrôle de présence documentaire, liens locaux et version ajouté à App integrity, avec tests de régression.
- Version applicative V2.4.1, code métier, workflow Actions et publications Pages conservés.

## V2.4.1 — amélioration UX/UI responsive

### Interface
- Typographie allégée : réduction des poids extrêmes sur les contenus courants.
- Renforcement du contraste des textes secondaires et métadonnées.
- Tailles fluides via `rem` et `clamp()` pour mieux couvrir mobile, tablette, desktop et écrans très étroits.
- Espacements, cartes et grilles rendus plus adaptatifs.
- KPI et historique renforcés pour les formats étroits de type Fold.
- Zones interactives agrandies sur les contrôles principaux.
- Chiffres financiers affichés avec des chiffres tabulaires sur les listes importantes.
- Respect de `prefers-reduced-motion`.

### Technique
- Aucun changement métier, formule, Supabase, RLS ou synchronisation.
- Cache et backend V2.4 conservés volontairement.
- Branche dédiée `v2.4.1` et preview séparée `/v2.4.1/`.


## V2.4 — synchronisation cloud

### Ajouté
- Inscription et connexion Supabase par email/mot de passe, confirmation d'email et réinitialisation du mot de passe.
- Magic Link conservé comme méthode secondaire.
- Création automatique d'un foyer personnel vide pour chaque inscription normale.
- Invitations à durée limitée et à jeton haché pour le deuxième membre du foyer.
- Synchronisation des catégories, budgets, transactions et récurrences.
- Mises à jour Realtime entre sessions.
- Indicateur d'état de synchronisation et informations du compte dans les paramètres.
- Cache local V2.4 isolé par foyer avec reprise non destructive de V2.3.
- Interface `/admin/` et Edge Function `admin-api` pour consulter les comptes, foyers et membres, désactiver/réactiver ou supprimer un compte, et supprimer un foyer.

### Fiabilité
- Snapshot immuable pendant chaque envoi cloud.
- Nouvelle modification conservée en attente lorsqu'elle survient pendant un envoi.
- Archivage cloud des suppressions pour éviter les résurrections de lignes.
- Priorité à une modification locale en attente lorsqu'un événement Realtime arrive.
- Fonctionnement local conservé si le SDK ou le réseau est indisponible et qu'un cache existe.

### Sécurité
- RLS actif sur toutes les tables publiques V2.4, y compris les tables d'administration.
- Accès limité aux membres du foyer et opérations propriétaire limitées aux owners.
- Mutations directes des adhésions révoquées au profit de RPC contrôlées.
- Limite de deux membres imposée par RPC et trigger SQL.
- Jetons d'invitation stockés uniquement sous forme SHA-256 et consommés atomiquement.
- Rôle administrateur stocké en base, sans email codé en dur, et privilèges élevés confinés à une Edge Function avec JWT obligatoire.
- Écritures séparées entre insertions et mises à jour afin de respecter les grants de colonnes immuables.
- SDK navigateur épinglé à `@supabase/supabase-js@2.117.2`.
- Validation automatique empêchant l'ajout d'un secret serveur au dépôt.

### Validation
- Audit statique étendu aux 19 modules, à l'interface admin, à la fonction serveur et aux migrations Supabase.
- Test automatique de conversion Supabase vers état local V5.
- Vérification du refus HTTP de la fonction admin sans JWT.
- Security et Performance Advisors relancés après toutes les migrations.
- Premier compte existant désigné administrateur global de façon ponctuelle côté base.

## Maintenance pré-V2.4

### Git
- Création de `develop` comme tronc de développement V2.
- Création de `gh-pages` pour séparer publication et code source.
- Ajout de l'audit automatique **App integrity**.
- Support de l'audit V1 monolithique et V2 modulaire.
- Workflow préparé pour les Pull Requests vers `main` et `develop`.
- Smoke test CI sur `develop` réussi avec le check **App integrity**.

## V2.3 — preview publiée

### Objectif
- Supprimer les transactions et budgets personnels du code actif.
- Introduire un état local V5 autonome.
- Ajouter un onboarding et une migration V1/V2.x.

### Confidentialité
- Le nouveau template est neutre et vide.
- Aucun montant réel historique n'est seedé dans le code actif.
- Les noms du foyer deviennent des données locales.
- Les catégories neuves ont des budgets à 0 €.
- Les exports V5 embarquent leur catalogue de catégories afin de ne plus dépendre des constantes publiques.

### Ajouté
- Onboarding au premier lancement.
- Création d'un budget vide.
- Détection des anciennes versions locales.
- Migration V1 / V2.0 / V2.1 / V2.2 vers V5.
- Import des sauvegardes legacy V4.
- Paramètres pour modifier le nom du foyer et des deux personnes.
- Helper legacy isolé pour reconstruire le profil historique sans remettre les données dans V2.3.

### Publication
- Preview disponible sous `/v2.3/`.
- PR de publication #6 fusionnée en squash.
- PR source #7 conservée en brouillon pour validation.

### Technique
- Schéma local passé de V4 à V5.
- `baseIncomeCategories` et `baseExpenseCategories` sont maintenant inclus dans l'état utilisateur.
- La preview V2.3 utilise une clé localStorage dédiée.

## V2.2 — preview publiée

### Objectif
- Refactorisation pure de l'architecture JavaScript.
- Aucun changement fonctionnel volontaire par rapport à V2.1.

### Refactorisation
- `js/app.js` découpé en 10 fichiers spécialisés.
- `app.js` réduit à l'initialisation finale.
- Ordre de chargement explicite via scripts `defer`.
- Schéma de données version 4 inchangé.

### Validation
- 125 fonctions métier conservées.
- Nombre d'écouteurs et d'accès au stockage inchangé.
- Syntaxe JS, IDs DOM et références DOM vérifiés.

### Publication
- Preview disponible sous `/v2.2/`.
- PR de publication #3 fusionnée en squash.
- PR source #4 conservée en brouillon pour validation.

### Corrigé
- Conflit de classe CSS `balance` supprimé.
- Le `letter-spacing` négatif est maintenant limité au grand montant de la carte principale.

Toutes les évolutions importantes du projet sont consignées ici.

## V2.1 — preview

### Corrigé
- Les mois futurs ne sont plus comptés comme des mois réellement actifs.
- La moyenne annuelle utilise uniquement les mois réellement renseignés.
- La courbe « Réel » s'arrête au dernier mois disposant d'opérations.
- Les mois futurs sont identifiés comme prévisions dans le suivi.
- Une catégorie archivée reste disponible lors de l'édition d'une opération historique.
- L'édition des opérations simples est réellement accessible depuis l'historique.

### Ajouté
- Copie locale et non destructive des données V1 vers la V2.
- Navigation clavier complète des menus personnalisés.
- Navigation mobile quatre onglets améliorée, avec grille 2×2 sur petits écrans.
- Méthode de travail basée sur `workstate.md`.

## V2.0 — preview initiale

### Ajouté
- Séparation de `index.html`, `css/style.css` et `js/app.js`.
- Moteur central `metricsForMonth()`.
- Onglet Suivi annuel.
- Revenus, dépenses, épargne et reste cumulé annuels.
- Détail individuel des deux personnes.
- Comparaison mensuelle et reste cumulé.
- Graphique réel / prévu.
- Édition technique des opérations simples.
- Validation renforcée des sauvegardes.
- Schéma de données version 4.

## V1 — production

### Fonctionnalités principales
- Vue d'ensemble mensuelle.
- Revenus, dépenses et épargne.
- Catégories et budgets prévu/réel.
- Attribution à deux / Personne 1 / Personne 2.
- Historique.
- Opérations récurrentes.
- Export/import JSON.
- Paramètres locaux.
