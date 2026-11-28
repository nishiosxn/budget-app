# Smart Budget — sauvegardes chiffrées hors de Supabase

## Objectif

Export PostgreSQL quotidien sur GitHub Actions, chiffré avec **age**, conservé dans les artefacts GitHub pendant **60 jours**. Le dépôt GitHub étant public, **aucune donnée financière en clair n'est publiée ou commitée**. La clé privée de déchiffrement reste exclusivement sur ton PC, avec une copie de secours.

Ce dispositif complète les sauvegardes privées Supabase (toutes les 6 h, 30 jours) et les copies de l'incident du 16 novembre ; il ne remplace pas une politique de sauvegarde indépendante à long terme.

## Activation (Windows)

### 1. Générer la clé sur ton propre PC

Ouvrir PowerShell, puis :

```powershell
winget install -e --id FiloSottile.age
age-keygen -o "$env:USERPROFILE\Documents\smart-budget-recovery-key.txt"
```

La commande affiche `Public key: age1...` et crée le fichier **privé** `smart-budget-recovery-key.txt`. Conserver deux copies privées sécurisées, dont une hors ligne. La clé privée **ne doit pas être partagée, téléversée sur GitHub, envoyée dans ChatGPT, ou enregistrée dans le dépôt**.

Pour réafficher uniquement la clé publique :

```powershell
age-keygen -y "$env:USERPROFILE\Documents\smart-budget-recovery-key.txt"
```

### 2. Configurer la clé publique dans GitHub

Dépôt `nishiosxn/budget-app` → **Settings → Secrets and variables → Actions → Variables → New repository variable**.

- Nom : `SMART_BUDGET_BACKUP_AGE_RECIPIENT`
- Valeur : uniquement la clé **publique** commençant par `age1...` (jamais `AGE-SECRET-KEY-...`)

Cette variable n'est pas secrète ; elle permet uniquement de chiffrer.

### 3. Configurer la connexion Supabase

Dans Supabase, projet Budget → **Connect → Session pooler** (port **5432**). Copier **la chaîne effectivement affichée** et remplacer le mot de passe. Utiliser `sslmode=require`. GitHub Actions utilise IPv4 : la connexion directe IPv6 n'est pas adaptée dans la configuration habituelle.

Dans GitHub → **Settings → Secrets and variables → Actions → Secrets → New repository secret** :

- Nom : `SMART_BUDGET_BACKUP_DATABASE_URL`
- Valeur : l'URL PostgreSQL complète du Session pooler, avec son mot de passe et `sslmode=require`.

**Ne copie jamais cette URL dans la conversation, une issue GitHub ou un commit.** La valeur doit rester dans les secrets GitHub.

### 4. Tester le premier export

Après publication du workflow sur `main` :

1. **GitHub → Actions → Smart Budget — sauvegarde externe chiffrée → Run workflow**.
2. Sélectionner `main`, puis exécuter.
3. Vérifier un run **Success**, puis télécharger l'artefact `smart-budget-chiffre-...`.
4. Extraire le fichier `*.dump.age` de son ZIP.
5. Vérifier le déchiffrement local sans importer dans Supabase :

```powershell
age --decrypt -i "$env:USERPROFILE\Documents\smart-budget-recovery-key.txt" -o "budget-verification.dump" ".\NOM_REEL_DU_FICHIER.dump.age"
```

Pour vérifier le contenu, installer les outils PostgreSQL 17 et exécuter `pg_restore --list budget-verification.dump`. Cela ne restaure aucune donnée. Supprimer ensuite le dump déchiffré du disque, et conserver précieusement la clé privée.

**Un run réussi ne prouve pas à lui seul que l'archive peut être restaurée** : un essai de déchiffrement et une inspection `pg_restore --list` sont indispensables.

## Protection et fonctionnement

- Exécution : **chaque jour à 03:43 UTC**, plus lancement manuel possible. GitHub peut décaler ou sauter un run planifié.
- Le job ne se déclenche **jamais sur une pull request** et n'a que des permissions GitHub en lecture seule.
- Le dump utilise PostgreSQL 17 (`pg_dump -Fc`) et couvre `public`, `smart_budget_backups` et `incident_backup_20261116`, y compris les lignes archivées.
- Le flux `pg_dump` est **directement chiffré** avec age v1.3.2 ; aucun fichier non chiffré n'est créé dans le runner ou publié dans GitHub.
- Seul le fichier `*.dump.age` est téléversé comme artefact. Rétention **60 jours**, sans commit et sans publication GitHub Pages.
- Sans clé publique configurée : job ignoré, **aucun export externe n'est effectué**. Sans URL secrète : le job échoue.
- Aucun outil de restauration n'est exposé à Smart Budget. Les six protections Supabase de l'incident sont inchangées.

## Limites

Ces dumps concernent les **schémas sélectionnés**, et ne comprennent pas automatiquement l'ensemble des services Supabase (comptes Auth, fichiers Storage, configuration externe). La restauration doit être préparée dans une instance isolée, avec validation des IDs, des rôles et des modifications effectuées depuis la sauvegarde.

Les artefacts d'un dépôt public expirent (90 jours maximum selon GitHub). Les workflows planifiés peuvent être désactivés après 60 jours d'inactivité du dépôt public. Il faut surveiller les runs et conserver une clé de déchiffrement utilisable. En cas de perte de cette clé, l'archive n'est pas récupérable.

Références : https://supabase.com/docs/guides/deployment/ci/backups et https://github.com/FiloSottile/age.


## Extension V3.1 à préparer

Le relevé 8D.1 n'a pas vérifié la configuration active de ce workflow ni sa restaurabilité. Les schémas private et smart_assistant_private doivent être pris en compte pour les brouillons, revues, listes pilotes et réservations ; valider les dépendances Auth et les droits lors d'une restauration jetable. Ne pas copier de clé privée de récupération ni publier de données en clair. Les essais de chiffrement utilisent une clé éphémère fictive, sans demander de manipulation à l'utilisateur. Voir [audit hébergé](V3_1_HOSTED_PREFLIGHT.md).
