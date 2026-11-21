# Smart Assistant — Unslop 31an : changements et vérifications

Branche : `work/v3.1-smart-assistant`. Base distante : `a6f7f34eb78b545bf0065954a1d86c9392a0f859`. Audit et direction validés par l’utilisateur le 21 novembre 2026. Lot limité au pilote ; aucune publication ni fusion.

## Modifications

- Champ de demande : placeholder court, hauteur mesurée après affichage et changement de largeur, plafond lié à la taille de police, défilement au-delà. Le micro et l’envoi conservent une cible de 44px minimum.
- Quota fermé initialement avec valeur visible ; métriques, dernière utilisation et information Cloudflare restent disponibles au dépliage. Les exemples sont plus compacts et se replient après envoi ; ils restent accessibles.
- Présentation réduite après analyse. La proposition est une région accessible qui reçoit le focus ; les cartes et le budget conservent leur structure existante.
- L’éditeur reçoit le focus dans son premier champ ; appliquer ou annuler restitue le focus au bouton Modifier. Nouvelle demande rend le focus à la saisie ; retirer une opération rend le focus à une opération restante.
- Annuler la modification et Abandonner la proposition désignent deux actions distinctes. Un dialog HTML modal protège les modifications, le remplacement de demande, la navigation et la déconnexion. Continuer la saisie est le choix initial ; Échap conserve le contenu. Une fermeture de page avertit sans conserver de données financières en stockage local. Les protections de confirmation incertaine et d’idempotence existantes sont conservées.
- Budget après ajout explicite la projection ; Budget actuel est utilisé après un enregistrement vérifié. Mois localisés et reconduction mensuelle visible. Les calculs et contrats d’écriture restent inchangés.
- Thèmes Système/Clair/Sombre isolés au pilote, palette et tokens existants réutilisés. Le logo et le violet #5C29D6 sont conservés ; l’étoile décorative est retirée. Surfaces neutres, hiérarchie typographique simplifiée et rayons cohérents.
- Animation d’éditeur par opacité/translation, sans animation de hauteur. Réduction des mouvements conservée.

## Tests automatiques

`node --test scripts/*.test.mjs` : **237 tests réussis, 0 échec** sur Node 24.18.1 Windows. La CI utilise Node 22 et conserve sa propre validation après le push.

`node scripts/validate.mjs` : réussi. La suite inclut les contrôles de synchronisation, parseur, budgets, éditeur, règles, confirmations, catégories, lots atomiques et protections de coût. Les nouveaux tests exécutent les branches de confirmation d’abandon, le redimensionnement du champ, les thèmes avec stockage inaccessible et la fermeture sans animation en mode réduit. Les contrastes des rôles de texte sur fond/carte/surface secondaire atteignent 4,5:1 ; les bordures de contrôles atteignent 3:1 ; le bouton de marque avec texte blanc atteint 4,5:1. Il s’agit de tests de palette, pas d’une certification WCAG complète.

## Rendus réels contrôlés

Navigateur Chromium intégré. Pages réellement servies sur localhost ; HTML, CSS et JavaScript de l’application. Le serveur `scripts/assistant-ui-fixture-server.mjs` fournit des données fictives et utilise le vrai moteur local pour les demandes. Il ne contacte aucun service externe et ne conserve aucune opération. Les captures ne présentent donc aucune donnée personnelle.

| Largeur CSS | Clair | Sombre | Débordement dans la proposition testée | Champ vide | Boutons visibles |
|---|---|---|---|---|---|
| 1280 | contrôlé | contrôlé | aucun | 16px, 42px de haut, contenu 42px | >=44px |
| 1440 | contrôlé | contrôlé | aucun | 16px, 42px de haut, contenu 42px | >=44px |
| 390 | contrôlé | contrôlé | aucun | 16px, 42px de haut, contenu 42px | >=44px |
| 320 | contrôlé | contrôlé | aucun | 16px, 42px de haut, contenu 42px | >=44px |

Parcours clavier observés : focus dans l’éditeur ; refus de l’abandon conservant 25,50€ saisis ; application locale donnant 25,50€ utilisés et 74,50€ restants avec retour sur Modifier ; Nouvelle demande refusée par Échap conservant la proposition ; abandon explicitement accepté puis retour de focus à la saisie ; tabulation vers Abandonner la proposition avec contour visible. Le formulaire à 320px s’empile. Les règles de catégorisation restent accessibles.

## Captures avant/après

Même demande fictive : « J’ai dépensé 20€ chez McDo », budget 100€, reste 80€. Le rendu avant provient de la version de base, avec les mêmes réponses locales. La comparaison complète porte sur la réduction de l’introduction et du quota, la lisibilité de la projection et l’accès aux actions.

- [Avant desktop sombre](unslop-captures/before-desktop-dark.jpg)
- [Après 1280 sombre](unslop-captures/after-1280-dark.jpg) / [clair](unslop-captures/after-1280-light.jpg)
- [Après 1440 sombre](unslop-captures/after-1440-dark.jpg) / [clair](unslop-captures/after-1440-light.jpg)
- [Avant mobile sombre 390](unslop-captures/before-mobile-dark.jpg)
- [Après 390 sombre](unslop-captures/after-390-dark.jpg) / [clair](unslop-captures/after-390-light.jpg)
- [Après 320 sombre](unslop-captures/after-320-dark.jpg) / [clair](unslop-captures/after-320-light.jpg)

## Limites et contrôles restants

- Zoom réel à 200% : non validé. Les raccourcis du navigateur intégré ne modifient pas son zoom. Le recours à Firefox Windows a été arrêté par l’environnement, dont la vérification des URL ne prend pas en charge ce navigateur. Le redimensionnement du champ avec police doublée est testé unitairement ; cela ne remplace pas un essai complet de zoom.
- Préférence de mouvement réduit : branche JavaScript sans animation testée et règles CSS présentes, mais aucun rendu réel avec cette préférence activée n’a pu être observé.
- iOS/Safari, clavier virtuel et VoiceOver/NVDA : non disponibles dans cette vérification.
- Le service hébergé refuse les appels Edge venant de localhost. Les tests visuels utilisent les réponses fictives locales ; aucun enregistrement réel, test multi-appareil ou appel backend modifié. Une préversion autorisée permettra la vérification de bout en bout avec le service existant.
- Les captures couvrent une proposition simple ; les calculs des lots, revenus, créations, récurrences et erreurs sont couverts par la suite automatisée existante. L’ensemble des variantes métier n’a pas été rejoué visuellement après correction.

## Prochaine étape

Revue de la PR brouillon, puis tests manuels du zoom, du mouvement réduit et d’iOS. Une décision explicite distincte reste nécessaire pour toute publication ; aucune promotion vers main n’est effectuée par ce lot.

Méthode : Unslop par Damir Sokolovsky, CC BY 4.0. Le dossier original complet, sa licence et ses attributions sont conservés dans `.agents/skills/unslop`.
