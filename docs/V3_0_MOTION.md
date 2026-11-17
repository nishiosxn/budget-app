# Smart Budget V3.0 — lot interface / motion

## Base et isolation
- Base du code: `develop`, avec la V2.9 (historique et récurrences).
- Travail isolé: `work/v3.0-motion-ux`.
- Production après la release : **V3.0** à la racine ; ancienne production conservée dans `/v2.8.1/`.
- Préversions `/v2.9/` et `/v3.0/` : **inchangées**. La V3.0 a été validée explicitement le 17 novembre 2026 avant la release.

## Implémentations
1. Démarrage: le tracé blanc du logo Smart Budget original se révèle progressivement depuis le haut, le long de sa forme, sans anneau externe. Progression liée à la session, au foyer, aux données et au rendu; animation de finition discrète. Pourcentage = étapes, pas estimation de temps ou d'octets réseau.
2. Skeletons de la vue d'accueil affichés pendant le chargement authentifié réel, sans délai artificiel.
3. Animation d'entrée et sortie des vues, sans page intermédiaire; navigation mobile existante conservée.
4. Incrémentation des KPI, première apparition et changements de valeur, à partir du DOM déjà calculé.
5. Courbe réelle animée, courbe prévue révélée, infobulle au survol, au toucher et au focus clavier.
6. Abonnements: seules les catégories dotées d'échéances figurent dans la partie principale, tri chronologique; catégories sans récurrence regroupées et repliables.
7. Accueil: les trois indicateurs ajoutés en V3.0 ont été retirés à la demande de l'utilisateur; les cartes et informations V2.9 sont conservées.
8. Micro-interactions sur cartes et ouverture des modales.
9. Adaptation responsive, palette CSS existante et `prefers-reduced-motion`.
10. Dépendances financières, historique, sauvegardes, schéma PostgreSQL, RLS et moteur de synchronisation inchangés.

## Validation avant toute publication
- CI App integrity, tests ciblés V3 et tests V2.9.
- Vérification navigateur sur un foyer de test: connexion, chargement, navigation rapide, historique, modification d'échéances, catégories, courbes et passage de mois.
- Contrôle sécurité: les nouvelles étapes visuelles ne déclenchent aucune écriture dans Supabase.
- Attention : ce lot n'inclut pas encore de synchronisation bancaire, de nouvelles statistiques financières ou de prévisions.

## Correctif du chargement continu
- L'animation du tracé du logo est interpolée chaque image et possède un reflet discret en mouvement constant; l'affichage du pourcentage est **estimatif**, non une mesure réseau.
- Les jalons de session, identification du foyer et données plafonnent la progression à 96 % avant la réussite réelle.
- L'ancien panneau « Connexion au foyer » ne s'affiche plus pendant le chargement normal : seul le splash V3.0 est visible. Le panneau reste disponible uniquement pour la connexion utilisateur, les invitations, la récupération et les erreurs.
