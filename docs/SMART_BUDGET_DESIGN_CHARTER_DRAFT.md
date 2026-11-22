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


## Révision expérimentale 31uf — moins de traits, davantage de structure

- Limiter les bordures à l'enveloppe externe de chaque panneau et aux séparations qui portent un changement réel de contexte. Ne pas ajouter une ligne sous chaque titre, chaque famille et chaque catégorie.
- Les catégories restent des lignes interactives compactes avec le fonctionnement réel de l'application, plutôt que des lignes fictives ne reproduisant qu'un bouton « Modifier ».
- Les boutons sélectionnés « Dépenses / Revenus » et « Par famille / Par catégorie » utilisent des **textes neutres**, jamais du texte violet. Le violet de marque sert à l'action et au focus.
- « Trier » ouvre un popover stylisé et utilisable au clavier, avec sélection visible et fermeture par Échap.
- Les modales d'édition reprennent les champs et actions réels : réel, prévu, nom, attribution, période, création et suppression, avec surfaces et boutons cohérents en clair et en sombre.
- Le prototype conserve les données fictives exclusivement en mémoire et désactive toute connexion applicative. La source de l'interface et des handlers vient de Smart Budget actuellement publié, complétée par le filtre introduit dans la PR #49.
- Avant validation finale de la charte, comparer les vrais rendus et interactions desktop/mobile. La présente charte n'autorise aucune refonte du reste de Smart Budget.


## Essai 31ug — priorités validées (22 novembre 2026)

- **Colonnes :** Obligatoires / Abonnements / Vie courante restent trois colonnes sur desktop, sans traits verticaux ; les familles non reconnues s'affichent en dessous dans une section Autres si nécessaire.
- **Séparateurs :** une seule fine ligne **horizontale entre catégories sœurs**, pas sous le dernier élément. Même logique pour revenus et épargne. Aucun trait superflu sous les titres de section.
- **Survol / sélection :** noms et chevrons neutres au hover et à l'ouverture ; sélection de légende sur une surface neutre. Violet de marque #5C29D6 conservé pour les actions primaires et le contour de focus clavier.
- **Chiffres :** propriétaire indiqué une fois sans répéter le mot Prévu ; « Total inchangé » si des enveloppes changent mais que le total net mensuel reste identique.
- **Interaction :** le filtre s'applique immédiatement après sélection. Le bouton « Voir les catégories » redondant est retiré de la sélection ; le raccourci « Modifier le budget », l'effacement du filtre et la liste détaillée sont préservés.
- **Fenêtres :** piège de focus Tab et retour au déclencheur ajoutés à la prévisualisation isolée ; ce comportement doit être porté dans l'application principale et vérifié avant fusion.
- **Couverture :** tests d'équivalence entre CSS/JS de source et de démo, catégories inattendues, net zéro, raccourcis existants, focus et mode clair/sombre. La validation visuelle réelle 320/390/1280/1440, iPhone et lecteur d'écran reste à effectuer.

La charte reste **une proposition**, pas une refonte approuvée de l'ensemble de Smart Budget. Pas de publication en production ni fusion de la PR #49.

## Prototype 31ui — interaction centrée sur les catégories (essai non validé)

**Source méthodologique :** Unslop (Damir Sokolovsky), CC BY 4.0.

- **Produit :** lecture et modification des enveloppes réelles et prévues d'un foyer
- **Caractère :** précis, autonome, posé
- **Univers :** tableau de bord financier domestique et regroupements de comptes
- **Moment :** jauges réel / prévu et barre de répartition, couleur uniquement lorsqu'elle informe
- **Signature :** violet Smart Budget #5C29D6 pour marque, sélection et focus ; jamais pour la couleur du texte au simple survol

### Nouvelle organisation expérimentale

1. Les panneaux restent Répartition, Revenus, Dépenses, Épargne. Les familles de **Dépenses** s'empilent dans l'ordre Obligatoires, Abonnements, Vie courante, puis Autres si nécessaire.
2. Chaque catégorie est une unité visuelle compacte, bordée d'un fin filet sur tout le périmètre : nom et chevron centré, propriétaire, réel cliquable, prévu cliquable, barre de progression, coche immédiate, engrenage et corbeille. Aucune action usuelle enfouie dans un sous-menu.
3. L'engrenage ouvre **une seule fiche de paramètres** (nom, réel, prévu, attribution, famille lorsqu'elle existe, portée du budget). L'édition simple du réel ou du prévu reste possible directement depuis son montant, en un clic.
4. « Tout remplir » aligne tous les réels ayant un prévu strictement positif, y compris les montants déjà renseignés, puis propose Annuler. « Tout vider » remet tous les réels à zéro après une seconde pression de confirmation, puis propose Annuler. Les catégories sans prévu ne sont pas effacées par Tout remplir.
5. Pour les dépenses, progression normale violette, dépassement de 0 à 15 % orange et au-delà de 15 % rouge, avec delta et pourcentage visibles ; pour les revenus et l'épargne, dépasser l'objectif reste une progression positive (vert). Sans budget prévu, jauge grise et mention pertinente « Sans budget » si le réel est non nul.
6. Les détails d'opérations se déplient uniquement si des opérations existent. Le chevron et les libellés restent neutres, jamais violets au survol.
7. Mobile : une catégorie par ligne, boutons tactiles, montants réorganisés sans troncature ; modal de paramètres adaptée en feuille basse. Conserver mode clair/sombre, accessibilité et prefers-reduced-motion.
8. Toutes les données de la prévisualisation restent fictives et uniquement en mémoire ; aucune interaction avec Supabase. Le nouveau code est exclusivement dans \`preview/category-distribution/\` et \`previews/pr-49/\` tant que la maquette n'est pas validée.

### À contrôler avant généralisation

Contrastes réels, capture mobile 320/390 et desktop 1280/1440, longues catégories, dialogues clavier, état sans budget, dépassement, revenu supérieur au prévu, dates, mois, filtre famille et retour au tout. **Les tests automatisés ne sont pas une preuve de conformité visuelle.**
