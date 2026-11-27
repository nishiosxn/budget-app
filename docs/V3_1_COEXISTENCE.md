# Recette 8B.5 — coexistence et récupération

- V3.0 : e2072063b30712ffcd1a27dc1f6adffce0d27965 (main lu avant la recette).
- V3.1 : SHA du workflow PR #52.
- Edge historique : [CI 44962165968](https://github.com/nishiosxn/budget-app/actions/runs/44962165968), source de PR 3b6a340352432428b8145aab086741a995cb6f8a (31ap). Correspondance exacte avec la version hébergée v30 non prouvée.

Le workflow exporte la V3.0 dans un répertoire temporaire et sert ses vrais fichiers dans une session Chromium indépendante, avec les substitutions de configuration nécessaires pour joindre Supabase local. Le test prépare un brouillon, interrompt la session, retire puis restaure l'autorisation fictive, reprend le Builder via l'interface V3.1, puis exerce la synchronisation des deux versions. Aucune donnée réelle.

## Edge v30 : compatibilité à prouver

La source 31ap lit le contexte du foyer, utilise les RPC historiques et l'en-tête 20261116-hf1 ; elle exige un foyer solo et une configuration Workers Free confirmée. Les migrations V3.1 sont additives. Avant recette hébergée, obtenir les fichiers exacts v30 ou leur provenance vérifiée, exécuter sur Supabase jetable avant/après migration avec fournisseur neutralisé explicitement, tester proposition/confirmation/rejeu/refus inter-foyers et le client 31ap. Ne pas appeler la production pour un test d'écriture. Compatibilité réelle v30 ouverte.

## Récupération administrative

Vérifier identité du propriétaire, foyer, setup non finalisé et reçu sans exposer le brouillon. Ne pas supprimer le setup ni les gardes, ne pas créer de second foyer. Pour un compte pilote dont la reprise est autorisée, rétablir uniquement son autorisation privée après validation explicite puis reprendre avec la même identité et le même requestId. Si le compte ne doit plus être pilote, décision distincte sur reprise ou abandon contrôlé ; aucune désactivation globale. Le test local couvre retrait/rétablissement et reçu idempotent. Perte définitive du compte : procédure encore à définir. Aucun script de récupération destructive ou opération hébergée.
