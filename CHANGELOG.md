# Changelog

## Maintenance Git avant V2.4

### Finalisé
- GitHub Pages basculé vers `gh-pages /(root)`.
- Déploiement depuis `gh-pages` validé.
- Snapshots `v2/`, `v2.1/`, `v2.2/`, `v2.3/` retirés de `main`.
- `develop` préparée comme tronc de développement V2.
- Audit **App integrity** validé sur une PR réelle vers `develop`.

### Ajouté
- Branche de publication `gh-pages` préparée.
- Audit automatique des Pull Requests vers `main`.
- Vérifications de syntaxe JS, DOM, données seed, formules critiques et migrations V4/V5.
- Documentation du workflow Git cible avant V2.4.

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
