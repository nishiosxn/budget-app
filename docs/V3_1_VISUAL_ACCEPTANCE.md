# Smart Budget V3.1 — Recette visuelle et PWA

Le violet #5C29D6 et le logo restent les repères de la marque. Les visualisations utiles sont la répartition, le suivi et la projection de l'Assistant. Les surfaces partagées restent discrètes et suivent la préférence d'apparence.

| Passe | Observation initiale et correction |
| --- | --- |
| Espacements | Les actions de connexion et de fermeture avaient des gabarits différents. Les contrôles principaux ont une cible de 44 px et les marges de l'administration se resserrent sur mobile. |
| Couleurs | La connexion sombre gardait un voile clair, la navigation active associait du violet foncé à un fond sombre et l'administration utilisait l'ancienne palette. Les rôles de surface, de texte et d'accent suivent le thème. |
| Icônes | Le logo et les pictogrammes de navigation restent les mêmes. Les icônes décoratives restent hors de l'arbre d'accessibilité et les actions iconographiques ont un nom explicite. |
| Microcopy | Le numéro V2.5 de l'administration disparaît. Les réglages affichent V3.1 préversion. Le chargement et l'échec du laboratoire ont leur propre message. |
| Typographie | La hiérarchie des maquettes reste en place. Les chiffres des tableaux d'administration s'alignent et le champ de montant a un nom accessible. |
| Layout | Les grilles des Catégories et la navigation existante sont conservées. La progression mobile garde les sept points. Les modales réservent les marges latérales de sécurité. |
| Détails | Les dialogues empilés retiennent le focus et le rendent à leur déclencheur. Les accents très clairs sont assombris pour le texte et les contrôles, tandis que la couleur enregistrée reste exacte. |
| Visuels | Les barres de répartition et le graphique du Suivi restent les principales visualisations. La référence Catégories garde ses fichiers historiques d'origine. |
| Animations | Le trait de progression du Builder utilise une transformation et l'étape courante se distingue par un contour. La réduction des animations est respectée. |

## Rendus et parcours

La CI joint des PNG de l'application connectée en 390 et 1 440 px, en clair et sombre. Le même scénario mesure 320, 375, 390, 430, 768, 1 024, 1 280, 1 440 et 1 920 px. Elle utilise la véritable interface, le SDK épinglé, des comptes fictifs et Supabase jetable. Les références Builder et Catégories sont les copies versionnées. Smart Assistant utilise les styles de confirmation validés dans la prévisualisation Unslop et la recette passe par l'Edge locale. L'administration est contrôlée à l'entrée et via le refus d'un compte ordinaire.

Le scénario connecté couvre le Builder duo, les vues Accueil, Catégories, Historique et Suivi, les paramètres, la transaction, l'infobulle tactile et la confirmation de l'Assistant avec récupération du reçu. La matrice est un contrôle de rendu Chromium. Le zoom visuel à 200 % et les gestes sont émulés. Le contrôle de contraste est ciblé sur les accents et les surfaces corrigées. Une certification WCAG AA intégrale et la validation VoiceOver nécessitent une recette dédiée.

## PWA et mesures

`pwa-performance.json` contient trois démarrages Chromium avec un profil neuf, un serveur HTTP de test sur loopback, le SDK réel servi localement et la liste des ressources reçues. Les temps locaux excluent la latence CDN et Supabase hébergé. Les octets du laboratoire sont mesurés sur les quatre scripts du dépôt. Le test contrôle le manifeste, les fichiers d'icônes, l'activation du service worker, le remplacement d'une révision, la suppression du cache historique et le retour réseau après un échec hors ligne. L'installation visible dans l'interface du navigateur dépend du navigateur et du système.

## Protocole iPhone Safari

Utiliser une préversion isolée du commit à vérifier reliée à un foyer fictif. La publication de cette préversion est une étape indépendante.

1. En Safari portrait, passer par Connexion, ouvrir Catégories, puis faire glisser le doigt sur plusieurs segments de répartition. Le repère doit suivre le doigt, rester dans l'écran et disparaître à la fin du geste. Avec Réduire les animations activé dans iOS, refaire le geste et parcourir deux étapes du Builder.
2. Dans le Builder et la modale Ajouter, sélectionner plusieurs champs texte et montant. Vérifier que Safari garde l'échelle au focus, que le clavier ne masque pas les actions et que la page reste zoomable manuellement à 200 %. Tourner l'appareil pour vérifier les côtés de l'encoche.
3. Depuis Ajouter, ouvrir Smart Assistant, saisir une demande fictive et afficher la confirmation. Après fermeture de la modale ou retour en arrière, localiser le déclencheur avec VoiceOver ou un clavier physique. Vérifier une fois en clair, sombre et Système.
4. Depuis Safari, utiliser Partager → Sur l'écran d'accueil. Ouvrir l'icône, vérifier les safe areas et la version dans Paramètres. Passer brièvement en mode avion, recharger et vérifier qu'aucune action financière n'est signalée comme enregistrée. Rétablir le réseau et rouvrir l'application.
5. Si une nouvelle révision de la préversion de test est disponible, fermer puis rouvrir la PWA et vérifier la version et le premier écran. Consigner le modèle, la version iOS, la révision, le résultat et une capture pour toute anomalie.
