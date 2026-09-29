# Changelog

## V2.2 — en développement

### Objectif
- Refactorisation pure de l'architecture JavaScript.
- Aucun changement fonctionnel volontaire par rapport à V2.1.

### Plan
- Découper `js/app.js` en config, data, storage, calculations, ui, categories, transactions, settings, tracking et app.
- Conserver le schéma de données version 4.
- Publier une preview séparée `/v2.2/` après validation.

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
- Détail Baptiste / Anaëlle.
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
- Attribution à deux / Baptiste / Anaëlle.
- Historique.
- Opérations récurrentes.
- Export/import JSON.
- Paramètres locaux.
