# Smart Budget V3.0 — lot interface / motion

## Base et isolation
- Base du code: `develop`, avec la V2.9 (historique et récurrences).
- Travail isolé: `work/v3.0-motion-ux`.
- Production à la racine de GitHub Pages: **V2.8.1 inchangée**.
- Préversion `/v2.9/`: **inchangée**. La V3.0 ne sera pas publiée sans validation.

## Implémentations
1. Démarrage: logo Smart Budget avec arc de progression depuis le haut en sens antihoraire, bornes attachées à la résolution réelle de session, foyer, chargement et rendu. Pourcentage = étapes, pas estimation de temps ou d'octets réseau.
2. Skeletons de la vue d'accueil affichés pendant le chargement authentifié réel, sans délai artificiel.
3. Animation d'entrée et sortie des vues, sans page intermédiaire; navigation mobile existante conservée.
4. Incrémentation des KPI, première apparition et changements de valeur, à partir du DOM déjà calculé.
5. Courbe réelle animée, courbe prévue révélée, infobulle au survol, au toucher et au focus clavier.
6. Abonnements: seules les catégories dotées d'échéances figurent dans la partie principale, tri chronologique; catégories sans récurrence regroupées et repliables.
7. Accueil: pourcentage du budget de dépenses utilisé, écart réel/prévu, nombre de catégories dépassant leur prévu (indicateurs de lecture seule).
8. Micro-interactions sur cartes et ouverture des modales.
9. Adaptation responsive, palette CSS existante et `prefers-reduced-motion`.
10. Dépendances financières, historique, sauvegardes, schéma PostgreSQL, RLS et moteur de synchronisation inchangés.

## Validation avant toute publication
- CI App integrity, tests ciblés V3 et tests V2.9.
- Vérification navigateur sur un foyer de test: connexion, chargement, navigation rapide, historique, modification d'échéances, catégories, courbes et passage de mois.
- Contrôle sécurité: les nouvelles étapes visuelles ne déclenchent aucune écriture dans Supabase.
- Attention : ce lot n'inclut pas encore de synchronisation bancaire, de nouvelles statistiques financières ou de prévisions.
