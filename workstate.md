# Workstate — Budget foyer

> Document de continuité de développement. À lire en premier au début de chaque nouvelle session.

## 1. État de référence

- Dépôt : `nishiosxn/budget-app`
- Production : `main` → V1
- Branche active : **v2.2**
- Base : **v2.1**
- Objectif V2.2 : **refactorisation JavaScript uniquement**
- Schéma de données : **4**, inchangé
- V2.1 fonctionnelle de référence : `24c85660b25a14d7f8ca0566c6b336f4dd0d2035`
- PR V2.1 : https://github.com/nishiosxn/budget-app/pull/2
- Preview V2.1 : https://nishiosxn.github.io/budget-app/v2.1/

## 2. Règle principale V2.2

La V2.2 ne doit introduire **aucune modification fonctionnelle volontaire**.

Doivent rester identiques à V2.1 :
- calculs ;
- données ;
- stockage ;
- interface ;
- wording visible ;
- récurrences ;
- historique ;
- page Suivi ;
- comportement responsive.

Le seul objectif est de rendre le code plus lisible et maintenable avant V2.3 et V2.4.

## 3. Architecture cible V2.2

```text
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
```

Responsabilités :

- `config.js` : constantes techniques, formatage, mois et utilitaires généraux.
- `data.js` : catégories et données seed actuelles. Elles seront retirées du code public en V2.3.
- `storage.js` : état local, chargement, migration, sauvegarde.
- `calculations.js` : budgets, visibilité, récurrences, métriques mensuelles.
- `ui.js` : rendu général, historique, dropdowns, navigation mois/onglets.
- `categories.js` : création, édition, suppression et ajustement des catégories.
- `transactions.js` : opérations simples, récurrences, annulation et actions d'historique.
- `settings.js` : paramètres, copie V1 → V2, import/export/reset.
- `tracking.js` : calcul et rendu de la page Suivi annuel.
- `app.js` : initialisation finale uniquement.

## 4. Ordre d'exécution navigateur

Les scripts restent des scripts classiques `defer`, chargés dans cet ordre :

```text
config → data → storage → calculations → ui → categories
→ transactions → settings → tracking → app
```

Choix volontaire : pas d'ES modules pendant ce jalon afin de minimiser les changements fonctionnels et éviter d'introduire des dépendances circulaires avant la V2.3.

## 5. Plan V2.2

### Phase A — préparation
- [x] Lire README/workstate.
- [x] Comparer V2.1 à V2.0.
- [x] Créer la branche `v2.2`.
- [x] Définir les responsabilités des fichiers.

### Phase B — découpage
- [ ] Extraire config/data/storage.
- [ ] Extraire calculations.
- [ ] Extraire UI/rendu/navigation.
- [ ] Extraire catégories.
- [ ] Extraire transactions/récurrences.
- [ ] Extraire settings.
- [ ] Extraire tracking.
- [ ] Réduire `app.js` à l'initialisation.

### Phase C — validation
- [ ] Vérifier syntaxe de chaque fichier JS.
- [ ] Vérifier qu'aucune déclaration n'est perdue ou dupliquée.
- [ ] Vérifier tous les IDs DOM référencés.
- [ ] Vérifier l'ordre des scripts dans `index.html`.
- [ ] Comparer les chaînes et fonctions métier avant/après.
- [ ] Corriger le conflit CSS `.balance` déjà identifié, séparément et explicitement.
- [ ] Publier `/v2.2/` avec stockage local isolé.
- [ ] Créer une PR brouillon V2.2.
- [ ] Mettre à jour README, CHANGELOG et ce workstate.

## 6. Méthode de travail

Au début d'une prochaine session :
1. lire ce fichier ;
2. comparer `v2.2` à `v2.1` ;
3. ne lire que les fichiers modifiés ;
4. reprendre la première case non cochée du plan.

Ne rescanner tout le dépôt qu'en cas d'incohérence ou avant fusion majeure.

## 7. Règles Git

- ne jamais force-push ;
- ne jamais modifier un snapshot V2.0/V2.1 déjà publié ;
- chaque jalon reçoit sa branche et sa preview ;
- `main` reste protégé et passe par Pull Request ;
- la preview V2.2 sera publiée par un changement versionné, pas en remplaçant `/v2.1/`.

## 8. Après V2.2

- **V2.3** : retirer les données personnelles/seed du code public et créer un onboarding/import propre.
- **V2.4** : backend Supabase, authentification et foyer partagé.
- **V2.5** : fiabilisation de la synchronisation et UX multi-utilisateur.
