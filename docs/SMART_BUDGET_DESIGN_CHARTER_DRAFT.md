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


## Essai 31uj — corrections de sécurité, lisibilité et sémantique

*La description de l'essai 31ui ci-dessus reste un historique. Les règles ci-dessous ont priorité dans la démonstration 31uj ; ce n'est toujours pas une validation pour l'application principale.*

- **Remplir les vides** : n'agit que sur des montants réels nuls avec un prévu positif. Un montant déjà renseigné ou dépassé ne doit jamais être réécrit par une action de groupe.
- **Coche individuelle** : si le réel est vide, un clic le renseigne ; s'il est non nul, le bouton demande une deuxième confirmation explicite avant de l'aligner sur le prévu. Une coche désactivée indique un réel déjà égal au prévu.
- **Tout vider** : deux clics de confirmation ; ajoute des ajustements compensatoires vers zéro **sans supprimer l'historique**.
- **Annuler** : ne retire que les ajustements créés par l'action concernée, identifiés par leur ID. Les opérations indépendantes ajoutées entre-temps survivent.
- **Une seule fenêtre pour les modifications existantes** : réel, prévu, attribution, famille et période sont accessibles depuis le montant, la roue crantée ou la répartition. Le formulaire de création reste distinct. Le nom s'applique à tous les mois ; prévu, attribution et changement de famille respectent la portée « Ce mois / Ce mois et suivants ».
- **Jauges informatives** : pour les dépenses, afficher le montant restant ou dépassé ainsi que le pourcentage ; pour revenus et épargne, le montant restant à recevoir ou épargner. Une catégorie sans budget ne montre pas une fausse progression à 100 %.
- **Contraste** : sur surfaces claires, orange #93550F, rouge #A52E35, vert #147E60 ; sur surfaces sombres, orange #F1BB6F, rouge #FF9998, vert #55DBA3. Ne pas confondre le violet de marque #5C29D6 et les couleurs sémantiques.
- **États archivés** : surfaces discrètes cohérentes avec les catégories actives, sans leur donner des actions qui ne sont plus applicables.
- **Limite de périmètre** : scripts, données et CSS de cette nouvelle UX restent dans le prototype statique, avec une politique connect-src none. Aucun appel Supabase, aucune donnée de compte, aucune intégration main/develop. La consolidation de la CSS du vrai produit attend la validation visuelle.

### Vérifications encore requises

Un passage en vrai navigateur desktop et iPhone, modes clair/sombre, 320/390/1280/1440, zoom 200 %, VoiceOver/lecteur d'écran, parcours de suppression, de récurrence et synchronisation reste nécessaire avant tout portage. Un succès des tests JS ne constitue pas une validation visuelle.


## Essai 31ul — disposition hybride A, priorité au téléphone

**Audit ciblé avant modification.** Dans la 31uj, les blocs Répartition, Revenus, Dépenses et Épargne étaient exclusivement empilés ; chacune des familles de dépenses présentait des catégories sur une colonne même sur un large desktop. Cette densité verticale obligeait à défiler longuement pour lire un foyer avec beaucoup de catégories. Les traitements d'écriture fictifs, l'historique, les modales et les filtres étaient déjà cohérents ; ils ne doivent pas être réécrits par un changement de layout.

**Direction Unslop** (Damir Sokolovsky, CC BY 4.0) :
- Produit : gestion des montants réels et des enveloppes prévues d'un foyer sur PC et téléphone.
- Caractère : posé, précis, immédiat.
- Univers : tableau de contrôle des finances domestiques, surfaces graphite et détails sémantiques.
- Moments : barre segmentée de répartition et jauges réel/prévu.
- Signature : violet Smart Budget #5C29D6 réservé à la marque et aux états financiers pertinents.

**Disposition proposée, à valider visuellement :**
1. Desktop suffisamment large (supérieur à 68rem de viewport) : Répartition des budgets à gauche (~52 %) et Revenus à droite (~48 %), avec deux petites catégories de revenus par ligne.
2. Dépenses sur toute la largeur en dessous : familles **Obligatoires**, **Abonnements**, **Vie courante** puis **Autres** le cas échéant ; à l'intérieur, deux catégories par ligne à partir de 47rem.
3. Épargne en dessous, deux catégories par ligne à partir de 47rem.
4. Tablette/intermédiaire (68rem et moins) : Répartition puis Revenus, chacun en pleine largeur. Les catégories peuvent rester sur deux colonnes lorsqu'elles ont de l'espace.
5. Téléphone (47rem et moins) : tous les panneaux et toutes les catégories sur une seule colonne ; actions de catégorie et boutons au moins 2.75rem, montants non tronqués et cartes qui se réorganisent sans débordement.
6. États et animations : éviter les labels décoratifs, les nouvelles bordures verticales, les survols violets et l'animation permanente. Conserver les focus visibles, les couleurs sémantiques contrastées, la préférence de réduction des mouvements, la sélection des segments et l'interaction de toutes les modales.
7. **Contrat technique :** le nœud categoryDistribution reste physiquement monté ; les sections sont rendues dans les emplacements dédiés à l'intérieur de categoryGrid afin de ne pas perdre les écouteurs d'événement délégués et l'état du graphique lors des filtres, changements de mois ou modifications. Aucun accès réseau ni écriture sur un foyer réel.
8. **Pas d'intégration avant validation :** cette version n'est que le prototype 31ul sur la PR #49. Refaire une recette réelle 320/390/768/1280/1440, clair/sombre et zoom, puis seulement porter la disposition dans l'application.

**Portée de la passe** : HTML, rendu JS, CSS du prototype et tests ; aucune modification de la production Smart Budget, des fonctionnalités de Smart Assistant, des données Supabase, des montants fictifs ni de la navigation de l'application.



## Essai 31um — chrome du produit et modales d'opérations

**Audit préalable :** le prototype 31ul ne montrait ni la navigation principale, ni le sélecteur de mois avec les flèches, ni la barre inférieure mobile, ni les boutons d'ajout. La carte « Répartition des budgets » était étirée verticalement en face des Revenus ; ses rangées CSS de grille automatiques se répartissaient l'espace selon le contenu, déplaçant visuellement le total lors du passage entre Dépenses et Revenus.

**Direction :** reproduire l'habillage publié de Smart Budget pour une seule page, sans recréer les autres pages ni connecter un foyer. Conserver le violet #5C29D6, les contrôles natifs lisibles sur iOS, le mode sombre/clair et les espaces du prototype hybride A.

- En-tête visuel conforme à l'application : identité du foyer fictif, statut « Démo locale », boutons thème et paramètres.
- Navbar desktop : Vue d'ensemble / Catégories / Historique / Suivi, avec Catégories seule active ; les autres pages ne sont ni construites ni accessibles dans le prototype.
- Sélecteur de mois avec flèches et liste native (octobre à décembre 2026), interactif et relié au simulateur.
- Actions « Rentrée d'argent » et « Dépense » visibles sur desktop et proposées dans la feuille d'actions du bouton + de la navbar mobile. Reprise des icônes, classes et du CSS de la navigation mobile publiée.
- Les deux fenêtres d'ajout reprennent les champs métier essentiels de Smart Budget : montant (avec stepper), libellé facultatif, date, attribution, catégorie, période « Ce mois seulement / À partir de ce mois » et validation.
- L'ajout ne crée que des transactions fictives en mémoire ; la récurrence de démonstration s'étend seulement aux mois disponibles. L'action peut être annulée sans toucher aux autres opérations. Aucun backend, stockage ou compte.
- Le panneau Répartition utilise les propriétés CSS align-content:start et grid-auto-rows:max-content ; le bloc de montant garde une empreinte verticale fixe, et le niveau de détail côté Revenus conserve un emplacement invisible sur desktop. Le total n'est plus repositionné par l'étirement automatique des rangées.
- Modes et UX : menu mobile au-dessus de la barre de navigation, dialogues tactiles en feuille basse, focus clavier confiné dans les modales, fermeture par Échap ou fond, contrôle du zoom iOS et préférence de réduction des animations.

**Limite :** les tests JS/DOM légers valident l'assemblage, les actions fictives et le contrat CSS, mais ne démontrent pas encore la correspondance visuelle exacte des rendus dans un navigateur desktop ou sur iPhone. À vérifier avant intégration.



## Variante 31un — panorama A + dépenses C (expérimentation)

**Version de référence conservée** : l'ancien prototype 31um est archivé, avec ses 13 fichiers statiques inchangés, sous previews/pr-49/versions/31um/ sur gh-pages. Le point de départ Git pour la branche de travail était 33af2687089366fe91ca090d4c13add2f95f886f. La nouvelle disposition peut être retirée sans réécrire les actions et les données fictives ; elle n'altère pas l'archive.

**Audit visuel et fonctionnel** :
- En 31um, la coquille centrale était plafonnée à 70rem même sur un grand écran : beaucoup de place inutilisée autour des quatre sections.
- Les familles Obligatoires / Abonnements / Vie courante étaient empilées verticalement. L'interface fonctionnait, mais imposait un défilement important avec de nombreuses catégories.
- Le système de catégorie est déjà complet en prévisualisation : réel et prévu cliquables, engagement individuel confirmé, fenêtre de paramètres, suppression confirmée, historique dépliable, remplissage des vides, remise à zéro et annulation ciblée, catégories archivées et répartition interactive.
- Les interactions, le modèle de données de démo, les modales et le sélecteur de mois ne doivent pas changer pour ce test d'agencement.

**Direction artistique Unslop** (Damir Sokolovsky, CC BY 4.0) :
- Produit : visualiser et modifier les enveloppes mensuelles réelles/prévues d'un foyer.
- Caractère : calme, exact, rapide à parcourir.
- Monde : instruments de suivi financier domestique, surfaces graphite lisibles.
- Moment : la barre segmentée de répartition et les jauges de catégories.
- Signature : violet Smart Budget #5C29D6 pour la marque, les actions utiles et les focus, jamais sur les textes au simple hover.

**Neuf passes appliquées au seul layout** :
1. Espacement : un rythme homogène entre les colonnes et des rangées compactes par famille, sans compresser les zones tactiles.
2. Couleurs : gris neutres pour les surfaces et les filets ; aucune nouvelle couleur décorative.
3. Icônes : conserver coches, engrenages, corbeilles et chevrons existants.
4. Microcopy : conserver les libellés financiers et les confirmations existants.
5. Typographie : titres de famille lisibles, montants tabulaires et textes financiers toujours visibles.
6. Layout : conteneur fluide jusqu'à 115rem, marges adaptées par clamp ; synthèse A (Répartition à gauche, Revenus à droite, Épargne après Dépenses) ; dépenses C (trois familles côte à côte avec rangées horizontales compactes).
7. Détails : aucune séparation verticale entre familles. Une ligne horizontale discrète au-dessus de chaque catégorie et sous la dernière de chaque liste ; surfaces de catégories non doublées.
8. Visuels : jauges réel/prévu conservées, sans autres graphiques ou badges inutiles.
9. Animations : état hover discret et motion réduit respecté.

**Responsive** :
- Desktop large : trois familles en colonnes, deux revenus par ligne et deux épargnes par ligne.
- Intermédiaire à 78rem : deux colonnes de familles.
- À 70rem : Répartition et Revenus s'empilent.
- À 50rem : toutes les familles de dépenses s'empilent.
- À 47rem : Revenus et Épargne passent sur une colonne.
- Téléphone : contrôles catégorie de 2.75rem minimum, montants ajustés et jauges/captions sans débordement.
- Le viewport 16:9 est une **référence visuelle desktop**, pas une contrainte de hauteur CSS sur la vraie page.

**Limites et autorisations** : uniquement la prévisualisation de PR #49, sans déployer le nouveau layout en production ni déplacer la logique de données. Vérifications de rendu navigateur desktop/iPhone et tests lecteurs d'écran à effectuer avant une éventuelle intégration.


## Essai 31up — actions primaires et survols financiers

Cette passe ne change **ni** la disposition validée A + C **ni** la position du bouton clair/sombre, de la navigation, du mois, ou de la barre inférieure mobile. La version 31un a été archivée, sans modification, dans previews/pr-49/versions/31un/ ; la 31um reste également archivée.

**Audit :** les boutons « Rentrée d'argent » et « Dépense » avaient deux traitements de surface très différents (violet pâle contre texte/contraste inversé), alors que tous deux déclenchent la même famille d'action. Le survol de chaque catégorie ajoutait un rectangle coloré non justifié autour d'une ligne qui n'est pas elle-même cliquable. Les jauges réelles/prévues restaient informatives mais ne fournissaient pas la décomposition utilisé / budget / reste au survol. La barre de répartition présentait déjà une infobulle mais affichait seulement les montants prévus.

**Direction :** chrome silencieux, une seule action primaire (Dépense) avec le violet Smart Budget #5C29D6, Rentrée d'argent en contour neutre. Les boutons des modales reprennent le violet de marque et conservent le même comportement. Icône + au même style que le bouton de navigation mobile. Aucun rouge/vert décoratif sur des boutons de navigation.

**9 passes Unslop ciblées** : conserver espacements, palette neutre, icônes cohérentes, microcopy actuelle, montants tabulaires, layout A + C, supprimer l'affordance de carte non cliquable, réserver le détail financier au seul survol/focus des barres, et éviter toute animation gratuite.

- **Catégories Dépenses / Revenus / Épargne :** pas de changement de fond ni de bordure sur la carte au hover ; seuls les boutons conservent leurs affordances.
- **Toutes les jauges de catégories :** l'infobulle indique le montant utilisé (ou reçu/épargné), le budget prévu et le reste (ou le dépassement). Pas de budget : afficher explicitement « Sans budget ». Le libellé accessible au clavier comprend les trois informations.
- **Répartition des budgets :** les segments colorés affichent la même décomposition au survol et au focus, selon le réel de leurs catégories. Le filtre tactile affiche aussi le détail réel/prévu/restant après sélection.
- **Téléphone :** toucher une jauge ouvre son détail ; toucher à nouveau ou ailleurs le referme ; fermeture au défilement et par Échap. Une zone de contact transparente élargit la barre visuelle à 2,75rem, sans épaissir la jauge.
- **Conservation :** 31un et 31um restent disponibles pour comparaison ; code nouveau limité à la prévisualisation isolée et à ses tests. Ni logique métier, ni données de compte, ni production ne sont modifiées.

Tests JavaScript, focus, responsive, couleurs et résultat sur véritable iPhone/desktop devront être validés avant tout portage.


## Essai 31uq — infobulles magnétiques

**Point de restauration** : l'ensemble des 16 fichiers de la version 31up a été figé dans previews/pr-49/versions/31up/ sur gh-pages. Les archives 31un et 31um sont également conservées. La disposition générale et les interactions du foyer fictif ne changent pas.

**Audit Unslop, ciblé sur l'animation** : les infobulles 31up étaient figées au-dessus des jauges ou des segments de répartition. Un déplacement du doigt ne déplaçait pas le détail financier, et le rendu manquait de continuité pour un geste tactile. La bonne matière visuelle est la jauge elle-même, pas un effet décoratif. Conserver le violet #5C29D6, l'économie de bordures, la typographie et les montants tabulaires. Pas de halo, de flou de mouvement, de mouvement automatique ou de nouvelle couleur.

**Comportement 31uq** :
- Une seule infobulle flottante, légèrement translucide (surface à 95 %), petite et au bord discret ; elle reprend les données réelles/prévues/restantes de chaque barre ou de la répartition, sans recalculer les budgets.
- Ordinateur : la souris fait apparaître l'infobulle et la déplace en x/y. Une marge virtuelle de 40 px en hauteur et de 12–18 px sur les côtés évite sa disparition brutale autour de la barre.
- Téléphone/tablette : un doigt posé sur une jauge active la capture du pointeur ; l'infobulle suit le doigt en x/y même au-delà de la barre. L'infobulle est au-dessus du doigt, puis en dessous si elle manque de place en haut. Les coordonnées sont contraintes par le viewport visible pour éviter les sorties d'écran.
- Les segments colorés de Répartition utilisent exactement la même mécanique. Un glissement horizontal sur plusieurs segments peut afficher leurs valeurs successives. Les petits déplacements de la souris dans la zone voisine ne coupent pas l'affichage.
- **Motion** : interpolation exponentielle via requestAnimationFrame (constante environ 68 ms), sans effet de flou. La préférence prefers-reduced-motion supprime toute inertie et transition.
- **Accessibilité** : un focus clavier montre le même contenu, Escape le masque. Les libellés ARIA existants gardent les trois informations. L'infobulle flottante n'intercepte aucun clic.
- **Gestes sans effets secondaires** : un tap sur un segment de répartition garde sa fonction de filtre ; un glissement tactile ne doit pas déclencher ce filtre. Le touch-action:none est limité aux jauges, pour préserver le défilement normal depuis les autres zones.
- **Performance** : un seul overlay, mesure des dimensions seulement quand son contenu change, animation annulée à la fermeture et nettoyage au changement de page/mois, redimensionnement ou défilement.

**Périmètre** : source et CSS isolés dans la prévisualisation de la PR #49 ; aucun portage vers l'application, les comptes, la production, Supabase ou Smart Assistant. Validation visuelle réelle sur iPhone et desktop toujours nécessaire.
