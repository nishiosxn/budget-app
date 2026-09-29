# Workstate — Budget foyer

> Source de vérité pour reprendre le développement sans rescanner le dépôt.

## 1. État actuel

- Dépôt : `nishiosxn/budget-app`
- Production : `main` → V1
- Dernier jalon validé : **V2.2**
- Branche de développement de référence : **develop**
- Dernier jalon source : **v2.3**
- Preview V2.2 : https://nishiosxn.github.io/budget-app/v2.2/
- PR V2.2 #4 : fermée comme jalon historique
- PR de publication V2.3 #6 : fusionnée en squash dans `main`
- PR source V2.3 #7 : brouillon, ne pas fusionner avant validation visuelle
- Objectif V2.3 : **retirer les données personnelles du code actif et rendre les sauvegardes autonomes**

## 2. Principes V2.3

La V2.3 doit :
- ne contenir aucune transaction personnelle initiale dans le code ;
- ne contenir aucun montant de budget personnel dans le template neuf ;
- ne dépendre d'aucun prénom codé en dur dans l'interface active ;
- stocker le nom du foyer et les deux noms localement ;
- stocker le catalogue de catégories de base dans l'état utilisateur ;
- permettre une migration explicite depuis V1/V2.x ;
- produire des exports V5 autonomes contenant toute la configuration nécessaire ;
- conserver les anciennes previews sans les modifier.

Important : les anciennes versions déjà publiées restent historiquement accessibles dans le dépôt public. V2.3 nettoie la version active et les futurs exports ; elle ne réécrit pas l'historique Git.

## 3. Schéma V5

Nouveaux champs principaux :

```text
schemaVersion: 5
onboardingComplete
household:
  name
  personB
  personA
baseIncomeCategories[]
baseExpenseCategories[]
transactions[]
... champs historiques de plans / suppressions / catégories custom
```

Les catégories de base deviennent donc des **données locales**, et non plus une configuration personnelle imposée par le code.

## 4. Template neuf

Le code public ne fournit qu'un template neutre :
- Personne 1 / Personne 2 ;
- catégories génériques ;
- budgets prévus à 0 € ;
- aucune transaction ;
- aucune marque/service personnel spécifique.

## 5. Migration legacy

La migration V1/V2.x doit :
1. lire la sauvegarde locale legacy ;
2. charger le profil structurel V2.2 depuis un helper de migration isolé ;
3. reconstruire les catégories historiques ;
4. conserver transactions, budgets, noms personnalisés, plans, suppressions et récurrences ;
5. inférer les noms des deux personnes depuis la configuration legacy lorsque possible ;
6. enregistrer immédiatement un état V5 autonome.

Aucune donnée V1/V2 ne doit être effacée pendant cette copie.

## 6. Onboarding

Au premier lancement :
- créer un nouveau budget ;
- migrer une version locale détectée ;
- importer une sauvegarde JSON.

Pour un nouveau budget :
- nom du foyer ;
- nom Personne 1 ;
- nom Personne 2.

L'application reste utilisable localement ensuite sans compte ni backend.

## 7. Plan

### Phase A — modèle
- [x] V2.2 validée par l'utilisateur.
- [x] PR V2.2 archivée.
- [x] Branche `v2.3` créée.
- [x] Plan V2.3 documenté.
- [x] Passer le stockage au schéma V5.
- [x] Remplacer les données seed par un template neutre.
- [x] Rendre le catalogue de catégories local/autonome.

### Phase B — interface
- [x] Remplacer les prénoms codés en dur par les données du foyer.
- [x] Ajouter l'onboarding.
- [x] Ajouter la modification des noms du foyer dans Paramètres.
- [x] Adapter reset/import/export au schéma V5.

### Phase C — migration
- [x] Ajouter le helper legacy V2.2.
- [x] Migrer V2.2/V2.1/V2/V1 sans écraser les anciennes données.
- [x] Supporter l'import de sauvegardes legacy V4.

### Phase D — validation/publication
- [x] Vérifier absence des anciennes transactions/montants personnels dans le code V2.3.
- [x] Vérifier syntaxe JS de chaque module.
- [x] Vérifier IDs/références DOM.
- [x] Vérifier création neuve par inspection du flux et état V5 neutre.
- [x] Vérifier moteur de migration locale et helper legacy statiquement.
- [x] Vérifier import/export V5 statiquement.
- [x] Publier `/v2.3/` avec clé localStorage isolée.
- [x] Créer PR V2.3 brouillon.
- [x] Mettre à jour README / CHANGELOG / workstate.

## 8. Validation effectuée

- syntaxe valide pour les 11 modules JavaScript ;
- concaténation globale valide ;
- aucun ID HTML dupliqué ;
- aucune référence DOM manquante ;
- aucune déclaration de fonction dupliquée ;
- plus aucune occurrence active des anciennes valeurs financières seed ;
- plus aucun prénom historique codé en dur dans l’interface ou les modules actifs ;
- clé de preview active : `budget-foyer-v2.3-preview`;
- helper legacy charge uniquement l’ancien profil V2.2 pour reconstruire les catégories lors d’une migration.

Limite volontaire : l’historique Git et les anciennes previews restent publics. V2.3 ne réécrit pas l’historique.

## 9. Architecture

V2.2 conservée, plus un module :

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
  onboarding.js
  app.js
legacy-profile.html
```

## 10. Workflow Git après V2.3

```text
main       → production stable
develop    → tronc V2
v2.4       → prochain jalon, créé depuis develop
gh-pages   → publication et previews
```

Règle à partir de V2.4 :
1. créer `v2.4` depuis `develop`;
2. développer et auditer sur `v2.4`;
3. Pull Request `v2.4 → develop`;
4. le check **App integrity** doit réussir ;
5. après validation, fusion squash dans `develop`;
6. publier le snapshot sur `gh-pages`;
7. ne fusionner `develop → main` que lorsqu'une V2 est jugée stable pour remplacer la V1.

## 11. Après V2.3

- **V2.4** : Supabase, authentification, foyer partagé et synchronisation.
- **V2.5** : conflits de synchronisation, cache/offline et UX multi-utilisateur.

## 12. Reprise de travail

À la prochaine session :
1. lire ce fichier ;
2. comparer `v2.3` à `v2.2` ;
3. reprendre la première case non cochée ;
4. ne rescanner que les fichiers concernés.


## 13. Audit CI central

Depuis la maintenance pré-V2.4, les Pull Requests vers `main` exécutent le check GitHub Actions **App integrity**. La V2.3 sert de première branche source pour vérifier ce contrôle avant de démarrer V2.4.


- Audit CI central validé : le workflow supporte désormais la V1 monolithique et l'architecture V2 modulaire. Le prochain commit V2.3 déclenche le check `App integrity`.


## 14. Maintenance pré-V2.4

- [x] Branche `gh-pages` préparée avec la production et les previews actuelles.
- [x] Branche `develop` créée depuis V2.3.
- [x] Audit automatique central ajouté.
- [x] Audit compatible avec V1 monolithique et V2 modulaire.
- [x] Workflow `develop` configuré pour les PR vers `develop` et `main`.
- [x] Smoke test réel sur PR vers `develop` : **App integrity = success**.
- [ ] Basculer GitHub Pages de `main /(root)` vers `gh-pages /(root)`.
- [ ] Après bascule Pages, retirer les dossiers de previews de `main`.
- [ ] Créer les tags de jalon V2.0 / V2.1 / V2.2 / V2.3.
- [ ] Supprimer les branches temporaires déjà fusionnées.
- [ ] Rendre le check `App integrity` obligatoire sur `main` (et idéalement `develop`).
