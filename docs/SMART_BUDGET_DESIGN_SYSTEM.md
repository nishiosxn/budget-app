# Smart Budget Design System — 1.1 (31x)
Statut : charte graphique, technique et éditoriale complète, implémentée progressivement dans Smart Assistant et destinée à la refonte de Smart Budget. La V1.1 formalise aussi le quota IA et les panneaux repliables. Référence pour la future refonte globale. Inspirations : Apple (retenue, géométrie, hiérarchie, feedback), ChatGPT (interface conversationnelle simple). Ni une reproduction de la charte Apple ni une certification d'accessibilité.

## 1. Principes
- Information financière en premier ; un seul niveau d'accent visuel principal.
- Interface native, calme, minimaliste : surfaces neutres, pas de gradients décoratifs, pas de verre/ombre forte, pas de bordures imbriquées inutiles.
- Les détails techniques, redondances et totaux non nécessaires disparaissent. Préserver toute information indispensable à la décision : attribution réelle en duo, nature épargne, date, catégorie, changement de budget, création d'une catégorie, dépassement, invalidité, simulation.
- Une action principale par groupe ; confirmation explicite. Le pilote peut enregistrer uniquement les opérations ponctuelles autorisées après validation expresse ; les autres opérations restent en simulation signalée. Une modification purement graphique ne doit déclencher aucune écriture.

## 2. Tokens couleur
| Token | Clair | Sombre | Rôle |
|---|---|---|---|
| --sb-brand | #5C29D6 | #5C29D6 | Identité, CTA, progression |
| --sb-brand-hover | #4F20C0 | #4F20C0 | Survol CTA |
| --sb-on-brand | #FFFFFF | #FFFFFF | Texte CTA |
| --sb-bg | #F5F5F7 | #141414 | Fond |
| --sb-surface | #FFFFFF | #1E1E1E | Carte |
| --sb-secondary | #F0F0F2 | #252525 | Surface secondaire |
| --sb-line | #E2E2E7 | #303030 | Bordure décorative / séparateur |
| --sb-control-line | #94949C | #73737C | Bordure fonctionnelle |
| --sb-ink | #1D1D1F | #F5F5F7 | Texte primaire |
| --sb-muted | #63636B | #A1A1AA | Texte secondaire |
| --sb-accent | #5C29D6 | #B49AFF | Lien, icône, focus |
| --sb-tint | #F0EAFE | #34254F | Fond icône |
| --sb-positive | #217844 | #77D6A0 | Revenu / disponible |
| --sb-negative | #B83B43 | #FF9595 | Dépense / dépassement |
| --sb-warning | #966200 | #F3C778 | Avertissement |
Les couleurs sont sémantiques. Les signes, libellés et états textuels portent également le sens. Thème système en pilote, tokens prêts pour data-theme clair/sombre. Le contraste WCAG AA est une cible : mesurer les états réels lors de l'audit.

## 3. Typographie
Police native : -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif. Aucun téléchargement de police. Tokens en rem (base navigateur 16 px conservée). Graisses 400 corps, 500 secondaire/action discrète, 600 titre/CTA, 650 grand titre et montant. Montants : tabular-nums, FR EUR, groupement par espace, virgule, signe moins véritable. Titres -0,025em (grand), -0,012em (carte), montants -0,025em ; autres tracking normal.
| Usage | Taille desktop/mobile | Interligne | Graisse |
|---|---|---|---|
| Hero | 28/24 px | 34/30 px | 650 |
| Section | 20 px | 26 px | 600 |
| Titre transaction | 16 px | 22 px | 600 |
| Montant | 18 px | 24 px | 650 |
| Corps | 15 px | 22 px | 400 |
| Bouton principal | 14 px | 20 px | 600 |
| Champ | 16 px | 24 px | 400 |
| Métadonnées, libellé, budget, actions compactes | 13 px | 18 px | 400/500/600 selon hiérarchie |
| Légende, source, note | 12 px | 16 px | 400/500 |
Les titres longs s'enroulent naturellement, sans ellipse forcée ; les montants ne sont pas tronqués. Les champs à 16 px évitent le zoom automatique à la saisie iOS ; zoom utilisateur autorisé.

## 4. Grille, espaces, rayon
Échelle : 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px. Demi-pas 2 entre titre et détail ; 4 pour métadonnées ; 8 pour micro-espaces/contrôles ; 12 pour cartes, champs et icône-texte ; 16 pour padding standard ; 24 entre groupes, 32–48 respiration ; 64 grandes séparations.
| Niveau | Desktop | Mobile <=599 px |
|---|---|---|
| Largeur maxi colonne (padding inclus) | 760 px | 100 % |
| Gouttière | 24 px | 12 px |
| Padding vertical page | 24 / 48 px | 16 / 48 px (+ safe area si nécessaire) |
| Rayon shell | 36 px | 28 px |
| Padding shell | 16 px | 12 px |
| Rayon carte concentrique | 20 px | 16 px |
| Padding carte | 16 px | 12 px |
| Rayon sous-surface strictement concentrique | 4 px | 4 px |
R_int = max(0, R_ext - inset). Si bordure de 1 px incluse dans l'inset physique, déduire également ce pixel pour alignement mathématique strict. Les tokens utilisent le padding nominal. Appliquer aux surfaces réellement concentriques, pas arbitrairement à chaque contrôle autonome ou cercle. Les contrôles ont leur propre rayon 12 px ; actions compactes 10 px ; icône 12 px ; progression 999 px ; rond microphone/envoi 50 %. Bordures 1 px. Le séparateur budget suit le padding de la carte et ne touche pas les bords. Aucune ombre portée sur carte de validation ; éventuel popover futur : 0 8px 24px rgba(0,0,0,.10).

## 5. Composants
- CTA principal violet sur blanc, hauteur >=44 px, padding 10px 14px, 14/20 600. Secondaire neutre contour 1px lisible. Gap 8. Disabled explicite (opacity .5 et disabled natif). Pas d'action destructive rouge saturé hors nécessité.
- Champs et select : 44 px minimum, padding 9px 12px, 16/24, rayon 12, labels 13/18, gap 4. Erreurs au champ/éditeur ; ne pas fermer en cas d'échec. Bouton compact Modifier avec icône crayon, retirer avec icône corbeille + nom accessible ; cible >=44x44, contour neutre. Icônes 16 px actions, 20 px catégories, conteneur 40x40, trait 1,7 px, coins/extrémités arrondis, décorations aria-hidden.
- Prompt : bulle de surface secondaire sans bordure, titre discret ; composer 1 ligne auto-extensible 42–180px, boutons circulaires 44px, contour/focus du composeur, textarea 16px.
- Carte : grille 40px / minmax(0,1fr) / montant max-content. Titre, descriptif seulement s'il existe, puis catégorie · date · payeur si duo · fréquence si non unique. Aucun préfixe Libellé, aucun badge Nouvelle. Épargne : nom de catégorie/nature explicite et signe cohérent. Budget prévu : ancien montant barré puis nouveau, variation conservée car utile. Montant à droite ; long texte revient à la ligne ; icône décorative retirée <=380px.
- Budget sous une dépense : séparateur 1px, padding haut 12px, titre Budget + valeur, progression 6px, Utilisé / Reste. Valeurs projection après lot entier, non solde bancaire. Progression violette et rouge si dépassement, reste signé et coloré. Pas de détail répété date/catégorie. Si non défini, l'indiquer sans inventer. Si indisponible, l'indiquer. État de chargement uniquement sur requête réelle, barre neutre sans attente artificielle. Définir un budget pour catégorie absente reste disponible.
- Lot : cartes avec gap 12px, pas de cadre additionnel, pas de net revenus/dépenses/variation de solde affichés ; les données par opération restent. Mention groupée des catégories à créer avant confirmation ; message de simulation unique. Actions Modifier / Retirer en bas, confirmation finale Annuler / Confirmer [n opérations]. Après confirmation, afficher un état réel ou simulé exact ; en cas de réponse réseau incertaine, ne pas encourager une ressaisie.
- Création de catégorie : titre et mois, lignes budget/dépense/reste et barre si budget >0, même contrôles. Rapport : lignes de chiffres, métadonnées discrètes. Les fonctions de calcul et de contrôle sont inchangées.
- Règles et quota : sections secondaires, texte 12–13px, champs fonctionnels et état de service conservés. Pas de badge technologique coloré en permanence.

## 6. Responsive et adaptation
Viewport >=1024 px desktop : colonne centrée de 760px, gouttière 24px ; 600–1023 px tablette : même colonne, largeur fluide, gouttière 24px ; 381–599 : gouttière 12px, shell compact, cartes pleines, suggestions empilées ; <=380 : grille transaction 2 colonnes sans icône décorative, formulaire et CTA empilés. Les actions wrap si nécessaire ; test de 320px à 1440px, paysage, clavier et zoom 200%. Prévoir safe-area bottom. Ne jamais masquer des données essentielles. Aucun bloc de largeur fixe hors icônes et cibles tactiles. Pas de défilement horizontal imposé.

## 7. Motion
--sb-fast 120ms (hover/focus/pression), --sb-enter 200ms (apparition éditeur), --sb-exit 160ms (fermeture), --sb-progress-time 250ms (progression), --sb-ease cubic-bezier(.2,.8,.2,1).
Entrée : opacité 0→1 et translation -4→0px. Fermeture : opacité 1→0, hauteur mesurée→0 ; annulation sécurisée si la proposition devient périmée. Aucun délai artificiel. Progression transition width lorsque valeur change sur un même élément ; rendu complet après modifier/retrait peut afficher directement la nouvelle valeur. Boutons sans rebond. Ne pas animer chaque carte sur chaque re-rendu. Animation de dictée uniquement pendant dictée. Respect prefers-reduced-motion, mouvement coupé.

## 8. Accessibilité et états
Cible WCAG AA (4,5:1 texte courant ; 3:1 grand texte et limites/indicateurs de contrôles nécessaires). Bordure décorative n'est pas unique repère interactif ; focus visible 2px avec offset 2px, focus groupé composeur. Cibles 44x44, accessible name pour icônes, vrais button, select, label, aria-live et aria-valuetext pour budget ; pas de couleur seule pour le statut. Date localisée FR, chiffres exacts en centimes, aucun arrondi du calcul. États : normal, hover seulement pointeur, focus clavier, disabled, chargement, erreur, vide/non défini, dépassement, confirmation simulée. Formulaire annule sans modifier ; appliquer revalide. Préserver lecture du montant signé et la mention de catégorie à créer. Aucune affirmation de conformité complète avant tests navigateur/assistive technology.

## 9. Mise en œuvre et gouvernance
Source de vérité CSS : preview/assistant/live/design-system.css. Les variables --sb-* décrivent le système ; les aliases hérités --bg, --panel, --accent permettent la transition. Cette feuille est chargée après les styles historiques dans le pilote uniquement. Ne pas modifier js/assistant-core.js, review-editor.js, ni Supabase pour un changement de DA. Pour la version suivante de Smart Budget : isoler tokens globalement, migrer composants progressivement, harmoniser les deux thèmes, faire revue graphique et tests responsive/keyboard/contraste/zoom, puis publier. Pas de régression financière ; vérifier composants, lecteurs d'écran, long montant, libellé long, catégorie nouvelle, pas de budget, dépassement, lot mixte et éditeur. Les tests CI contrôlent le contrat et la présence de la charte ; le rendu réel doit être validé séparément.


## 10. Grammaire des composants : cadre et alignements (révision 31x)

Le conteneur principal utilise un rayon nominal de 36 px et un padding de 16 px sur desktop, ramenés à 28 et 12 px sur mobile. Une carte imbriquée directement dans le cadre suit la relation rayon intérieur = max(0, rayon extérieur − inset physique) : 36 − 16 = 20 px sur desktop, 28 − 12 = 16 px sur mobile. Sur une surface imbriquée dans cette carte avec padding de 16 px, le rayon concentrique nominal est 4 px. Cette relation concerne **les surfaces concentriques partageant un même centre de courbure** : elle ne s'applique pas aux contrôles autonomes (boutons, pictogrammes, jauges), qui possèdent leurs propres rayons fonctionnels.

La bordure nominale est de 1 px. Dans une composition nécessitant une concentricité géométrique parfaite, tenir compte aussi de la position réelle des traits et de l'inset de bordure : il peut être nécessaire de soustraire l'épaisseur de bordure au calcul nominal, selon la façon dont les contours sont dessinés. Le but est un alignement **optique et géométrique**, pas uniquement une égalité CSS.

Règle obligatoire : un conteneur définit son **unique padding horizontal**. Ses descendants directs suivent le même inset ; aucun descendant ne rajoute arbitrairement 8 px de marge pour « corriger » un alignement. Les actions sont alignées sur la grille de contenu, non sur la bordure externe. Les séparateurs s'arrêtent au bord de contenu ; ils n'atteignent pas le contour externe. Une zone d'information = une seule surface et, si nécessaire, une seule bordure. Pas de carte dans une carte pour de simples métadonnées.

| Objet | Surface | Contour | Retrait | Rayon |
|---|---|---|---|---|
| AppShell de l'assistant | Primaire | 1 px | 16 / 12 px | 36 / 28 px |
| Carte d'opération | Primaire | 1 px | 16 / 12 px | 20 / 16 px |
| Zone de demande | Secondaire | Aucun | 16 / 12 px | 20 / 16 px |
| Disclosure « Règles » | Primaire | 1 px | 0 sur le details | 20 / 16 px |
| En-tête du disclosure | Même fond | Trait inférieur uniquement à l'ouverture | 16 / 12 px | Hérite du contour |
| Contenu du disclosure | Aucun fond propre | Aucun | Même inset que l'en-tête | Sans objet |
| Quota IA | Intégré au shell | Séparateur supérieur | Retrait horizontal 0 dans le shell | Pas de deuxième boîte |
| Champ ou bouton indépendant | Primaire ou secondaire | 1 px fonctionnel | 12 px interne | 12 px |
| Barre budgétaire | Rail et progression | Aucun | Alignée au contenu | 999 px |

## 11. Comportements détaillés : quota IA et règles de catégorisation

**Quota.** Le titre du foyer et le bouton de déconnexion sont disposés en colonnes fluides ; sous 380 px, ils se répartissent verticalement. Le compteur est séparé du titre par un trait fin et une respiration de 16 px. Il comporte un libellé discret à gauche, une valeur tabulaire à droite, une barre de 6 px sur toute la largeur disponible, les appels et le restant affichés sans surcharge, puis une ligne « Dernier prompt ». Le dernier prompt n'a **pas** de nouvelle carte : un simple trait horizontal le distingue. Les informations de confidentialité sont une note discrète, pas une alerte colorée. Ne jamais afficher un quota à zéro lorsqu'il est seulement indisponible.

**Règles de catégorisation.** Utiliser un element natif details avec summary ; le summary fait toute la largeur et conserve une cible >= 44 px. Supprimer la marge non maîtrisée du triangle natif et afficher un chevron décoratif à droite : fermé vers le bas, ouvert vers le haut, rotation fonctionnelle 160 ms. Le texte du summary commence à la même abscisse que la description, les champs, les associations et les détails secondaires lorsqu'ils sont affichés. Le details n'ajoute **aucun padding** ; le summary et les autres enfants reçoivent eux-mêmes l'inset du shell (16 px desktop ou 12 px mobile). En état ouvert, un seul séparateur suit le summary.

Le formulaire de correspondance utilise 3 colonnes sur desktop (mot-clé / catégorie / bouton), 2 sur tablette et mobile standard (bouton sur la ligne suivante), puis une colonne sur les très petits écrans. Chaque champ ou bouton a une cible >= 44 px. Les associations enregistrées ont un fond secondaire discret et sont séparées de l'inventaire automatique, lequel utilise son propre details natif **sans encadré supplémentaire**. Le pied (« associations dans ce navigateur » et « Tout effacer ») revient à la ligne si besoin ; ne jamais réduire les cibles tactiles.

## 12. Typographie et composition fine

La police est une pile système sans chargement de polices externes. Toute la hiérarchie est définie en rem dans les futures pages ; les équivalents ci-dessous sont à la base habituelle de 16 px. Employer clamp() pour les titres réellement fluides, grid minmax(0,1fr) pour les colonnes de texte, flex-wrap pour les lignes flexibles, max-width ou min() pour limiter les colonnes, et dvh uniquement lorsque le viewport vertical intervient réellement. Les unités px restent pertinentes pour un filet de 1 px, un pictogramme de grille stricte et certains seuils de médias ; aucune dimension rigide ne doit empêcher la lecture avec zoom.

| Composant typographique | Taille | Graisse | Hauteur de ligne | Tracking |
|---|---|---|---|---|
| Hero | 1.75 rem desktop / 1.5 rem mobile | 650 | 2.125 / 1.875 rem | −0.025em |
| Titre de page / section | 1.25 rem | 600 | 1.625 rem | −0.018em |
| Titre d'une opération | 1 rem | 600 | 1.375 rem | −0.012em |
| Montant principal | 1.125 rem | 650 | 1.5 rem | −0.025em |
| Corps | 0.9375 rem | 400 | 1.375 rem | normal |
| Bouton primaire | 0.875 rem | 600 | 1.25 rem | normal |
| Métadonnée, budget, label | 0.8125 rem | 400–600 | 1.125 rem | normal |
| Note ou source de calcul | 0.75 rem | 400–500 | 1 rem | normal |
| Saisie | 1 rem minimum | 400 | 1.5 rem | normal |

Les montants emploient tabular-nums et un format monétaire fr-FR stable. Ne pas utiliser des polices condensées pour forcer un montant sur une ligne. Les titres et descriptions longues passent à la ligne ; si l'espace mobile est insuffisant, les icônes décoratives disparaissent avant le texte ou le chiffre.

## 13. Palette et application des couleurs

La hiérarchie des surfaces est la suivante : toile de fond, carte neutre, surface secondaire uniquement pour une information distincte. La marque conserve son violet #5C29D6 sur les CTA et l'indicateur de budget. Les liens et focus dans le thème sombre utilisent un violet plus clair pour le contraste. Les autres teintes sont sémantiques, non décoratives.

- Fond : clair #F5F5F7 ; sombre #141414.
- Carte : clair #FFFFFF ; sombre #1E1E1E.
- Surface secondaire : clair #F0F0F2 ; sombre #252525.
- Bordure décorative : clair #E2E2E7 ; sombre #303030.
- Bordure de champ : clair #94949C ; sombre #73737C.
- Texte principal : clair #1D1D1F ; sombre #F5F5F7.
- Texte secondaire : clair #63636B ; sombre #A1A1AA.
- Revenu et restant : clair #217844 ; sombre #77D6A0.
- Dépense et dépassement : clair #B83B43 ; sombre #FF9595.
- Avertissement : clair #966200 ; sombre #F3C778.

La couleur **ne suffit jamais** pour exprimer un montant ou un statut : signe, texte et disponibilité doivent le compléter. Pas de grands aplats colorés hors CTA ou surface de marque. Ne pas considérer le design conforme WCAG AA sans mesure des contrastes dans les vraies conditions d'usage.

## 14. États, micro-interactions et motion

Une interface complète comprend normal, hover (pointeur uniquement), focus-visible, actif, disabled, chargement réel, vide, donnée absente, erreur, confirmation réelle, confirmation simulée et résultat non vérifié. Les actions irréversibles sont nommées explicitement et soumises à confirmation. La sélection clavier sur summary utilise Entrée/Espace sans JS de substitution ; l'anneau de focus mesure 2 px avec offset de 2 px et ne doit pas être rogné par un overflow abusif.

Les transitions sont courtes : 120 ms pour le retour visuel sur pression ou survol ; 200 ms pour l'entrée d'un éditeur ; 160 ms pour sa fermeture ; 250 ms pour la mise à jour d'une jauge. Courbe principale cubic-bezier(.2,.8,.2,1), sans rebond ni effet gratuit. Avec prefers-reduced-motion, les transitions et mouvements décoratifs sont neutralisés. Ne pas masquer une progression métier sous un skeleton artificiel. Les informations se recalculent sur de vraies données.

## 15. Localisation et microcopy

Utiliser un tutoiement cohérent et une formulation courte : « Modifier », « Retirer », « Confirmer », « Simuler », « Budget », « Utilisé », « Reste ». Un libellé contextualisé s'affiche sans préfixe « Libellé : » lorsque sa nature est évidente. Les mentions de catégorie nouvelle sont regroupées, pas répétées dans chaque carte. Une date proche peut s'afficher « 19 nov. », une date hors année doit rappeler l'année. La zone test doit expliquer clairement la portée de toute écriture réelle.

Ne jamais annoncer « enregistré » sur un simple clic : seul le résultat de persistance vérifié le permet. Après une erreur réseau incertaine, conserver l'identité du lot et proposer une revérification plutôt qu'une ressaisie pouvant créer un doublon. Éviter les messages systèmes longs qui apparaissent entre le montant et la barre de budget.

## 16. Architecture de composants cible pour la future refonte

1. AppShell : largeur maximale, navigations desktop/mobile, safe area, scroll et hauteur dynamique maîtrisés.
2. PageHeader : titre, contexte bref, action unique et niveau de navigation clair.
3. Card / Surface : un fond, un contour si nécessaire, géométrie concentrique vérifiée.
4. FinancialOperationCard : titre, description, catégorie/date/payeur, montant signé, actions accessibles.
5. BudgetProgress : plafond, rail, utilisé et restant ; cas absence, zéro et dépassement.
6. FormField / Input / Select / Picker : label visible ou accessible, états cohérents, 16 px minimum pour la saisie.
7. Disclosure : composant details/summary natif, chevron à droite, insets cohérents ouvert/fermé.
8. QuotaIndicator : valeur tabulaire, source, activité récente, note discrète.
9. ActionBar : une action primaire, annulation neutre et gestion des états.
10. Loading / Empty / Error / Toast : état réel, message clair, motion adaptée.

Les mêmes tokens doivent piloter le Journal, les Budgets, les Abonnements, l'Historique, les Paramètres et l'Assistant. Aucun composant d'une page ne doit définir une nouvelle échelle d'espacement indépendante.

## 17. Responsive, contrôle qualité et migration

Test de référence aux largeurs 320, 375, 390, 430, 599, 600, 768, 1024 et 1440 px, en modes clair et sombre et à zoom 100 % / 200 %. Les champs et boutons gardent une cible tactile >=44px, les libellés longs ne débordent pas, les grilles se réduisent avec minmax(0,1fr), les titres et montants restent lisibles, les marges ne s'effondrent pas. Tester portrait, paysage, clavier physique, zoom utilisateur et safe-area sur téléphone. Le bas du panneau repliable doit conserver le même inset que le haut. Aucun défilement horizontal imposé.

La cible est WCAG AA : au moins 4,5:1 pour le texte courant, 3:1 pour les grands textes et les contours essentiels des composants. Tester les cas avec lecteur d'écran (VoiceOver/NVDA), tabulation et focus sur les boutons et summary, ainsi que reduced-motion. Les assertions CSS automatiques ne remplacent pas ces contrôles visuels ni un audit d'accessibilité.

Le pilote charge encore des feuilles historiques avant design-system.css : les règles propriétaires de la version 1.1 sont volontairement bornées à pilotSession et pilotRules afin d'éviter d'affecter Smart Budget en production. La refonte globale devra supprimer progressivement ces couches héritées et normaliser la cascade avec les couches reset, tokens, base, components, utilities. Toute migration se fera par composants avec tests de non-régression des écritures financières et validations d'écrans, sans fusion prématurée dans main.
