# Changelog

## V2.6 — catégories simplifiées

### Interface
- Montants réels directement cliquables, sans crayon dédié.
- Montants prévus directement cliquables.
- Action individuelle en un clic pour renseigner un réel vide avec le montant prévu.
- Le bouton rapide « réel = prévu » disparaît une fois le montant renseigné, sans ajouter de coche persistante.
- Actions secondaires regroupées derrière un menu `⋯` par catégorie.
- Suppression conservée avec la confirmation existante, mais retirée du premier niveau visuel.
- Totaux de groupe rendus plus explicites avec les libellés « réel » et « prévu ».
- Menus adaptés au mobile avec des zones tactiles plus confortables.

### Actions groupées
- « Tout remplir » devient « Remplir les vides » et ne remplace plus les montants réels déjà saisis.
- « Tout vider » est déplacé dans un menu secondaire et nécessite un second clic de confirmation.
- Les remplissages groupés et individuels créent toujours des ajustements visibles dans l’historique.
- Les actions rapides peuvent être annulées depuis le toast existant.

### Vue d’ensemble
- « Reste disponible ce mois » conserve la formule réelle du foyer : revenus réels − dépenses réelles − épargne réelle.
- Les cartes Épargne affichent désormais en valeur principale l’épargne réelle du mois ; le cumul passe en information secondaire.
- « Répartition du mois » affiche un solde par personne seulement lorsqu’un solde d’ouverture est renseigné pour le mois.
- Une seule attribution est utilisée partout : **Baptiste / Anaëlle / À deux**.
- Cette attribution sert à la fois à la répartition mensuelle et au calcul du solde personnel : Baptiste = 100 % Baptiste, Anaëlle = 100 % Anaëlle, À deux = 50/50.
- Le solde affiché est calculé comme : solde d’ouverture + revenus réels attribués − dépenses réelles attribuées − épargne réelle attribuée.
- Le solde d’ouverture se modifie directement depuis la carte de la personne et n’est jamais compté comme un revenu.

### Technique
- Ajout de la table Supabase `account_opening_balances`, isolée des transactions et des budgets, avec RLS par foyer.
- Chargement cloud et Realtime des soldes d’ouverture ; aucune persistance financière locale ajoutée.
- L’essai « compte débité/crédité » a été retiré : aucune seconde attribution n’est conservée.
- Septembre 2026 a été reconstruit en opérations détaillées à partir du relevé Boursobank de Baptiste : Courses regroupe notamment Aldi/Intermarché via les libellés, et la catégorie Aldi dédiée est archivée.
- Pour septembre uniquement, **Courses** est attribué à Baptiste ; à partir d’octobre le budget Courses redevient **À deux**.
- Le solde Baptiste de septembre est vérifié à **130,19 €** avec la seule attribution : 108,18 € d’ouverture + 1 073,64 € de revenus attribués − 1 051,63 € de dépenses attribuées.
- Historique et Suivi conservent leurs calculs existants.


## Maintenance — workflow hybride

- Branches permanentes `main`, `develop`, `gh-pages` ; nouveaux lots sur `work/vX.Y-<lot>` avec Draft PR vers `develop`.
- Tags immuables pour les jalons validés ; les branches de version historiques deviennent supprimables après archivage.
- Guide Codex/Work, méthode dédiée et contrôle documentaire intégrés à **App integrity**.
- La promotion V2.5.1 conserve le code métier, la synchronisation cloud-only, la PWA et les migrations existantes.

## V2.5.1 — interface et synchronisation cloud directe

### Interface
- Header desktop réorganisé : identité + synchronisation/paramètres sur la première ligne.
- Navigation + mois + actions de transaction regroupés sur la seconde ligne.
- Header mobile compact : identité à gauche et synchronisation/paramètres à droite.
- Sélecteur du mois déplacé sur sa propre ligne mobile, navigation placée en dessous.
- Badge de synchronisation réduit au voyant seul sur les écrans très étroits.
- Nom du foyer tronqué proprement lorsqu'il manque de place.
- Bouton de relance manuelle affiché à côté de l’état de synchronisation lorsqu’un envoi échoue.

### Synchronisation
- Suppression du mode hors ligne et de la persistance du budget courant dans `localStorage`.
- Supabase devient la source de vérité à chaque ouverture.
- État courant conservé uniquement en mémoire pendant la session.
- Baseline de fusion V2.5 conservée en mémoire au lieu d’être persistée.
- Synchronisation déclenchée presque immédiatement après chaque modification.
- En cas d’échec, la relance manuelle renvoie l’état complet de la session vers Supabase.
- Reprise automatique au retour de la connexion lorsqu’une session contient des changements non envoyés.
- Rafraîchissement cloud au retour au premier plan lorsque la session est déjà synchronisée.
- Service worker conservé pour l’installation PWA, sans fallback de données ou ressources hors ligne.

### Technique
- Schéma V5, Supabase et règles RLS inchangés.
- Branche dédiée `v2.5.1` et preview séparée `/v2.5.1/`.

## V2.5 — synchronisation robuste

### Synchronisation
- Ajout d'une baseline locale par foyer avec les payloads normalisés et les `updated_at` distants.
- Fusion à trois versions : baseline, état local et état Supabase.
- Fusion automatique des changements indépendants sur une même ligne.
- Détection explicite lorsque le même champ est modifié différemment sur plusieurs appareils.
- Détection des conflits suppression / modification.
- Résolution manuelle depuis les paramètres avec priorité locale ou priorité cloud.
- Les changements non conflictuels sont conservés quelle que soit la préférence choisie pour le conflit.

### Fiabilité
- Écritures optimistes protégées par `updated_at`.
- Une modification distante survenant pendant l'envoi stoppe l'écriture au lieu d'être écrasée.
- Reprise non destructive des caches V2.4/V2.4.1 vers un cache V2.5 séparé.
- Reprise de l'ancien indicateur de modifications hors ligne.
- Index uniques `(household_id, legacy_id)` sur catégories, transactions et récurrences pour limiter les doublons liés aux retries et doubles onglets.

### Interface
- État « Conflit de synchronisation » conservé pendant les événements Realtime.
- Carte de résolution des conflits dans Paramètres & données.
- Correctifs mobile : Paramètres défilables et haut de page réorganisé sur petits écrans.
- Installation PWA : manifest, icônes, mode standalone, service worker et guide d'ajout à l'écran d'accueil sur mobile.
- Identité Smart Budget validée : ancien B remplacé dans l'application et les icônes SVG, ICO, Android et Apple ; précache PWA renouvelé.

### Supabase
- Migration `20260930104500_v2_5_sync_deduplication.sql` appliquée.


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


## V2.4 — synchronisation cloud (branche active)

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
