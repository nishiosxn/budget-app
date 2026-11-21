# Smart Budget — charte UI/UX V3.1 (proposition à valider)

**Statut : essai limité à la page Catégories de la PR #49.** Ne pas appliquer au reste de l'application sans validation visuelle explicite.

Source méthodologique : *Unslop*, Damir Sokolovsky, CC BY 4.0 — https://github.com/heydamir/unslop

## Direction

- **Produit :** budget partagé par foyer, avec lecture immédiate des enveloppes prévues, montants réels et actions financières.
- **Caractère :** précis, calme, compact.
- **Univers :** tableau de bord financier domestique, données tangibles plutôt que décoration.
- **Moment visuel :** la barre proportionnelle de répartition ; les figures réelles et prévues dans chaque section.
- **Signature :** accent violet Smart Budget `#5C29D6` réservé à la sélection et aux actions principales.

## Règles à expérimenter

1. **Structure :** une surface principale par section (Répartition, Revenus, Dépenses, Épargne), même rayon et même padding. Titres **dans** le panneau. Pas de titres flottants suivis d'une seconde couche de cartes.
2. **Sous-parties :** familles de dépenses réparties en colonnes, avec séparateurs discrets plutôt que cartes autonomes. Sur écran étroit, une colonne et séparateurs horizontaux.
3. **Information :** privilégier total, réel, prévu, pourcentage et modifications mensuelles effectives. Ne pas afficher des consignes d'utilisation, descriptions marketing, félicitations, labels de remplissage ni états « tout va bien » sans intérêt.
4. **Rythme :** espacement basé sur des multiples de `0.25rem`; padding de panneau `clamp(1rem, .8rem + 1vw, 1.5rem)`; écarts entre panneaux `1rem`, sous-parties plus denses.
5. **Couleurs :** surfaces et séparateurs via `--panel`, `--panel-2`, `--line`, `--text`, `--muted` existants ; violet de marque `#5C29D6`. Les couleurs de la répartition ont un sens par série et les couleurs revenu/dépense restent sémantiques.
6. **Typographie :** une taille de titre commune `clamp(1rem, .96rem + .25vw, 1.1875rem)` ; chiffres tabulaires, hiérarchie par taille et contraste plutôt que par graisse extrême. Corps de lecture au moins `0.8125rem` dans cette carte.
7. **Icônes :** ne pas multiplier les pictogrammes décoratifs. Un bouton iconique doit conserver un nom accessible.
8. **Actions :** garder les commandes réelles (modification, ajout, menus, filtres) à leur place fonctionnelle. Ne pas créer d'écriture depuis une visualisation en lecture seule. Conserver focus, clavier, tactile et `prefers-reduced-motion`.
9. **Mouvement :** survol et sélection informatifs uniquement ; transitions de 140–240 ms ; pas d'animation permanente.
10. **Isolement :** appliquer les overrides sous `#categories` et les sélecteurs `.cg-` ; ne pas modifier globalement le design system sans approbation.

## Contrat de validation avant généralisation

Comparer visuellement à 320, 390, 1280 et 1440 px, clair et sombre. Tester sélection d'un segment, filtre, retour à la liste, édition, changement de mois, épargne, aucune enveloppe, plusieurs catégories, survol, focus, `Escape` et animations réduites. Vérifier la cohérence de calculs et l'absence d'écriture réseau dans la démo.

Si ce prototype est refusé : revenir aux états du commit antérieur dans la PR #49 ; aucune modification en production.
