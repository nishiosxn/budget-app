# Workstate — Budget foyer

> Document de continuité de développement. À lire en premier au début de chaque nouvelle session.

## 1. État de référence

- Dépôt : `nishiosxn/budget-app`
- Branche de production : `main`
- Version publique stable : **V1**
- Branche de développement active : **v2.1**
- Base de v2.1 : branche **v2**
- Dernier commit fonctionnel connu de v2.1 avant documentation : `6491a071d0b82451abd82690e5190558dea72d88`
- Schéma de données local : **4**
- PR V2.0 historique : https://github.com/nishiosxn/budget-app/pull/1

## 2. URLs

- Production V1 : https://nishiosxn.github.io/budget-app/
- Snapshot V2.0 : https://nishiosxn.github.io/budget-app/v2/
- Preview V2.1 : https://nishiosxn.github.io/budget-app/v2.1/

Règle : ne jamais remplacer un ancien dossier de preview. Une nouvelle version reçoit un nouveau chemin.

## 3. Protocole de travail obligatoire

1. Lire `README.md` puis `workstate.md`.
2. Identifier la branche active et le dernier commit de référence.
3. Utiliser un diff GitHub entre la branche active et sa base avant toute inspection large.
4. Lire uniquement les fichiers ou sections qui ont changé, sauf incohérence détectée.
5. Avant chaque écriture, récupérer le SHA actuel du fichier ciblé.
6. Ne jamais utiliser de force-push ni réécrire l'historique.
7. Pour un nouveau jalon fonctionnel, créer une nouvelle branche/version au lieu de modifier un snapshot précédent.
8. Après les changements : vérifier syntaxe JS, IDs HTML dupliqués, références DOM manquantes et cohérence des liens de preview.
9. Mettre à jour `workstate.md`, `CHANGELOG.md` et le README si l'état visible du projet change.
10. Publier une nouvelle preview versionnée sur GitHub Pages sans supprimer les anciennes.

## 4. Architecture à connaître

Source V2.x :

```text
index.html
css/style.css
js/app.js
```

La V1 historique était principalement monolithique. La V2 a déjà séparé HTML, CSS et JavaScript. Le découpage de `app.js` en `data.js`, `storage.js`, `calculations.js`, `ui.js` et `tracking.js` est reporté à une V2.x ultérieure.

## 5. Stockage

- V1 : `budget-foyer-v1`
- V2 source : `budget-foyer-v2`
- Preview V2.0 : `budget-foyer-v2-preview`
- Preview V2.1 : `budget-foyer-v2.1-preview`

Les previews doivent rester isolées. La V2.1 contient une action explicite permettant de copier les données V1 vers la V2 sans modifier la V1.

## 6. V2.1 — travail effectué

Objectifs issus de l'audit V2.0 :

- [x] Ne plus considérer les mois futurs comme des mois réalisés actifs.
- [x] Arrêter la courbe « Réel » au dernier mois réellement renseigné.
- [x] Distinguer visuellement les mois futurs avec statut « À venir · prévu ».
- [x] Ajouter la copie locale V1 → V2.
- [x] Conserver une catégorie archivée comme option lors de l'édition d'une ancienne opération.
- [x] Rendre les menus personnalisés utilisables avec Flèche haut/bas, Home, End, Entrée, Espace et Échap.
- [x] Optimiser les quatre onglets sur mobile, avec passage en grille 2×2 sur les petits écrans.
- [x] Afficher réellement le bouton d'édition des opérations simples dans l'historique.

Contrôles statiques réalisés après modifications :

- syntaxe JavaScript valide ;
- aucun ID HTML dupliqué ;
- aucune référence `getElementById()` manquante ;
- stockage V2 séparé de la V1 ;
- contrôles de migration, catégories archivées, suivi futur et navigation clavier présents.

## 7. Règles métier importantes

- `Reste du mois = revenus - dépenses - épargne`.
- L'épargne réduit le disponible mais n'est pas une dépense de consommation.
- « À deux » répartit les montants à 50/50.
- Les budgets prévus peuvent s'appliquer au mois uniquement ou à partir du mois.
- Les catégories créées plus tard ne doivent pas apparaître rétroactivement.
- Une catégorie supprimée peut rester archivée si des opérations historiques l'utilisent.
- Les récurrences peuvent être modifiées/supprimées pour le mois, à partir du mois ou pour toute la série.
- L'historique est la source explicative des montants réels.

## 8. Points volontairement reportés à une V2.x

- Découpage de `js/app.js` en modules.
- Suppression/migration des données personnelles initiales codées en dur.
- Synchronisation Baptiste/Anaëlle via backend et authentification.
- Éventuelle intégration Supabase.
- Tests automatisés navigateur/end-to-end.
- Revue plus poussée de l'accessibilité générale hors menus.
- Gestion de migration entre différentes previews V2.x si elle devient nécessaire.

## 9. Convention de versions

- **V1.x** : production historique.
- **V2.0** : premier jalon Suivi annuel.
- **V2.1** : fiabilisation UX/calculs du Suivi et migration V1.
- **V2.2+** : nouveaux lots fonctionnels.
- Une version déjà publiée n'est jamais écrasée ; les corrections suivantes incrémentent la version.

## 10. Consigne pour la prochaine session

Ne pas rescanner tout le dépôt par défaut.

Commencer par :
- lire ce fichier ;
- comparer la branche active à son dernier jalon ;
- inspecter uniquement les fichiers modifiés depuis le dernier commit indiqué ici.

Un rescan complet n'est justifié que si le workstate ne correspond plus au dépôt, si des modifications externes inconnues sont détectées, ou avant une fusion majeure vers `main`.
