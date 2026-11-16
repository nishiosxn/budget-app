# Smart Budget V3.0 — lot interface / motion

## Base et isolation
- Base du code: `develop`, avec la V2.9 (historique et récurrences).
- Travail isolé: `work/v3.0-motion-ux`.
- Production à la racine de GitHub Pages: **V2.8.1 inchangée**.
- Préversion `/v2.9/`: **inchangée**. La V3.0 ne sera pas publiée sans validation.

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
