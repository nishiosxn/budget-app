# Workstate — Budget foyer

> Source de vérité pour reprendre le développement sans rescanner le dépôt.

## 1. État actuel

- Dépôt : `nishiosxn/budget-app`
- Production : `main` → V1
- Dernier jalon validé : **V2.3**
- Branche de développement de référence : **develop**
- Base du prochain jalon : **develop**
- Preview V2.2 : https://nishiosxn.github.io/budget-app/v2.2/
- PR V2.2 #4 : fermée comme jalon historique
- PR de publication V2.3 #6 : fusionnée en squash dans `main`
- PR source V2.3 archivée comme jalon historique
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

## 10. Après V2.3

- **V2.4** : Supabase, authentification, foyer partagé et synchronisation.
- **V2.5** : conflits de synchronisation, cache/offline et UX multi-utilisateur.

## 11. Reprise de travail

À la prochaine session :
1. lire ce fichier ;
2. comparer `v2.3` à `v2.2` ;
3. reprendre la première case non cochée ;
4. ne rescanner que les fichiers concernés.


## 12. Workflow Git cible avant V2.4

Préparation effectuée :
- branche `gh-pages` créée depuis le site publié actuel ;
- audit automatique ajouté via `scripts/validate.mjs` ;
- workflow `.github/workflows/validate.yml` sur chaque PR vers `main`.

Architecture cible :
```text
main        → code stable uniquement
v2.x        → développement actif
gh-pages    → production + previews versionnées
tags        → jalons immuables
```

État après bascule GitHub Pages :
1. [x] GitHub Pages utilise `gh-pages /(root)`.
2. [x] Déploiement GitHub Pages depuis `gh-pages` réussi.
3. [x] Les dossiers de previews ont été retirés de `main`.
4. [x] `develop` existe comme tronc V2.
5. [x] Le check **App integrity** a été validé sur une PR vers `develop`.
6. [ ] Créer les tags de jalon V2.0 / V2.1 / V2.2 / V2.3.
7. [ ] Supprimer les branches temporaires fusionnées.
8. [ ] Rendre le status check **App integrity** obligatoire sur `main` et idéalement `develop`.

Les opérations d'administration GitHub (source GitHub Pages, création de tags et suppression de branches) doivent rester traçables et ne sont pas simulées par des branches ordinaires.


## 13. État de maintenance avant V2.4

- GitHub Pages : `gh-pages /(root)`.
- `main` : V1 + documentation + CI uniquement.
- `develop` : tronc V2 à utiliser pour créer `v2.4`.
- `gh-pages` : production et previews historiques.
- Audit automatique : **App integrity**.
- Dernier test réel CI sur architecture modulaire : **success**.

Ne pas démarrer V2.4 tant que les trois tâches d'administration GitHub restantes (tags, suppression des branches temporaires, check obligatoire) ne sont pas terminées.
