# Smart Budget Design System — 1.0 (31u)
Statut : norme de design initiale, appliquée au pilote Smart Assistant seulement. Référence pour la future refonte globale. Inspirations : Apple (retenue, géométrie, hiérarchie, feedback), ChatGPT (interface conversationnelle simple). Ni une reproduction de la charte Apple ni une certification d'accessibilité.

## 1. Principes
- Information financière en premier ; un seul niveau d'accent visuel principal.
- Interface native, calme, minimaliste : surfaces neutres, pas de gradients décoratifs, pas de verre/ombre forte, pas de bordures imbriquées inutiles.
- Les détails techniques, redondances et totaux non nécessaires disparaissent. Préserver toute information indispensable à la décision : attribution réelle en duo, nature épargne, date, catégorie, changement de budget, création d'une catégorie, dépassement, invalidité, simulation.
- Une action principale par groupe ; confirmation explicite. Aucune écriture ni nouvelle inférence dans ce lot.

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
- Lot : cartes avec gap 12px, pas de cadre additionnel, pas de net revenus/dépenses/variation de solde affichés ; les données par opération restent. Mention groupée des catégories à créer avant confirmation ; message de simulation unique. Actions Modifier / Retirer en bas, confirmation finale Annuler / Confirmer [n opérations]. Après simulation, verrouiller et indiquer l'état, aucune écriture.
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
