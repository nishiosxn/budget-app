# Budget foyer

Application web personnelle de suivi de budget mensuel pour un foyer à deux.

## Accès

- **Version stable V1** : https://nishiosxn.github.io/budget-app/
- **Snapshot V2.0** : https://nishiosxn.github.io/budget-app/v2/
- **Preview V2.1** : https://nishiosxn.github.io/budget-app/v2.1/
- **Preview V2.2** : https://nishiosxn.github.io/budget-app/v2.2/

Le dépôt est public. Les opérations saisies dans l'application restent dans le `localStorage` du navigateur et ne sont pas envoyées sur GitHub. Les données initiales présentes directement dans le code source restent en revanche visibles dans le dépôt.

## État actuel

- **Production** : V1
- **Développement actif** : V2.2
- **Branche active** : `v2.2`
- **PR V2.0 historique** : #1, fermée sans fusion et conservée comme jalon
- **PR V2.1** : #2, jalon précédent
- **V2.2** : refactorisation JS terminée, preview publiée
- **PR V2.2 source** : #4, brouillon
- **Synchronisation multi-appareils** : non implémentée ; prévue pour une V2.x ultérieure

## Fonctionnalités principales

La V1 permet de gérer les revenus, dépenses, épargne, catégories, budgets prévus, récurrences, historique, attribution Baptiste / Anaëlle / à deux, export/import JSON et navigation mensuelle.

La V2 ajoute un onglet **Suivi** avec bilan annuel, comparaison mensuelle, reste cumulé, détail individuel et graphique réel / prévu.

La V2.1 fiabilise le suivi annuel, distingue les mois futurs des mois réalisés, arrête la courbe réelle au dernier mois renseigné, permet la copie V1 → V2, conserve les catégories archivées lors de l'édition, améliore les menus au clavier et adapte la navigation mobile à quatre onglets.

## Architecture actuelle

```text
index.html
css/
  style.css
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
  app.js
README.md
workstate.md
CHANGELOG.md
```

La V2.2 a découpé l'ancien `js/app.js` monolithique en fichiers spécialisés sans modifier volontairement la logique métier. `app.js` ne contient plus que l'initialisation finale.

## Données locales

- V1 : `budget-foyer-v1`
- V2 source : `budget-foyer-v2`
- Chaque preview publiée utilise une clé dédiée afin de ne pas modifier une autre version.

La V2.1 propose une copie **V1 → V2** depuis les paramètres. Cette action ne modifie jamais la V1.

## Méthode de travail GitHub

Le fichier **[workstate.md](workstate.md)** est la source de continuité du projet. Avant une nouvelle session de développement, il faut le lire avant de rescanner le dépôt.

Les versions déjà publiées ou utilisées comme jalons ne sont pas écrasées. Une évolution significative crée une nouvelle branche/version (`v2.1`, `v2.2`, etc.) et une nouvelle URL de preview. Les anciens snapshots restent disponibles.

Voir **[CHANGELOG.md](CHANGELOG.md)** pour l'historique des versions.
