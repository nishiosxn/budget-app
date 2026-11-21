# Workstate — Budget foyer

## Lot 31an — Unslop Smart Assistant (audit validé)

- Branche conservée : `work/v3.1-smart-assistant`, base distante `a6f7f34eb78b545bf0065954a1d86c9392a0f859`. Le skill original est repris depuis `work/v3.1-unslop` dans `.agents/skills/unslop` sans modification des fichiers source ni de leur attribution.
- Pilote seulement : composer mobile mesuré à nouveau après affichage/redimensionnement, quota et exemples dépliables, hiérarchie après analyse, focus d’édition/restitution, abandon explicite avec dialog clavier, protection avant fermeture, dates et récurrences lisibles, thèmes système/clair/sombre. Marque et moteur conservés.
- Vérification locale : 237 tests Node réussis, validateur de l’application réussi. Huit rendus 1280/1440/390/320 × clair/sombre, absence de débordement dans la proposition testée, cibles >=44px et saisie 16px. Parcours d’édition, recalcul et abandon/refus testés dans un navigateur avec serveur de données fictives utilisant le vrai moteur local.
- Limites : le pilote hébergé refuse les appels Edge depuis localhost ; aucun test d’écriture réelle ni déploiement backend. Zoom navigateur 200% non vérifié (raccourcis in-app sans effet, Firefox Windows bloqué par la politique URL). Réduction de mouvement vérifiée par tests de branche JS et règles CSS, pas par émulation visuelle. iOS/Safari et lecteur d’écran indisponibles. Voir le rapport QA pour le périmètre exact.
- Aucun merge, aucune publication, aucune modification des données financières ou de la synchronisation. Prochaine étape : revue de la PR et tests manuels restants, puis décision explicite de publication de préversion.


## V3.1 — Smart Assistant, chantier isolé

### 31am — résolution interactive d'une catégorie manquante (21 novembre 2026)
- Pour une commande **simple et non ambiguë** telle que « J'ai payé 50 € en Gundam », si le nom n'existe dans aucune catégorie du foyer, Smart Engine répond localement avec `clarify` et une métadonnée serveur `missingCategory` validée (nom, montant en centimes, date, mois, propriétaire). **0 token Gemma, 0 écriture** à ce stade. Le message indique explicitement qu'aucune catégorie ne sera créée automatiquement.
- Carte inline Deep Dark harmonisée avec les cartes existantes, sans modale : question de confirmation, nom prérempli modifiable, budget mensuel **vide et obligatoire**, dépense initiale en lecture seule, date/mois, jauge projetée lorsque le budget est valide, choix alternatif parmi les catégories de dépenses disponibles et possédées par B.
- Deux actions explicites : **« Créer et enregistrer »** (catégorie, budget forward et dépense ponctuelle en un commit atomique via `smart_assistant_create_category_pilot_v2`) ou **« Enregistrer la dépense »** dans une catégorie déjà existante via la confirmation transactionnelle habituelle. « Annuler » ne produit aucune écriture. Budget absent ou invalide = bouton désactivé.
- Nouveau chemin JWT `confirm_missing_category` distinct de `confirm_category`. Le serveur revalide la phrase d'origine dans un catalogue minimal indépendant des créations ultérieures, impose montant/date/mois/personne identiques à la dépense explicitement demandée, et ne permet la création qu'après action distincte ; le RPC garde le contrôle ultime anti-doublon et le reçu idempotent. Le chemin explicite antérieur continue à refuser une simple dépense.
- Reprise réseau : identifiant `requestId` conservé lorsque le résultat est incertain, entrées et choix bloqués pour empêcher des changements de contenu durant la reprise ; conflit définitif affiché sans enregistrer partiellement.
- Tests : **229 applicatifs + 2 contrôles complémentaires, 0 échec** sur le commit `c942ea7262f14cd035716efe6321c4d7b4c29135` (run `44949017058`). Couvre les propositions locales, fausses commandes enchaînées, doublons, autorisation JWT, montant/date non altérables, idempotence et éléments visuels/réactifs par inspection statique.
- Edge Function Supabase **v29** ACTIVE, `verify_jwt=true` et 6 fichiers vérifiés identiques. Pas de modification SQL/migration, pas de dépense fictive écrite par le développeur, pas de modification du foyer personnel ni de `main`. Validation manuelle de l'interface et d'une confirmation authentifiée encore nécessaire.



### 31al — recette finale, correction du coût IA pour les commandes citées (21 novembre 2026)
- Retour utilisateur : la requête affichée `« J’ai payé 50 € en Gundam. »` déclenchait **Gemma 4, 2 208 tokens** alors que la variante sans guillemets était locale depuis 31ak. Origine : une paire de guillemets entourant la commande empêchait les parseurs d'actions exactes de correspondre.
- Correction symétrique du moteur `js/assistant-core.js` et du miroir serveur `supabase/functions/_shared/smart-assistant-core.js` : retirer seulement **une paire de guillemets extérieurs équilibrée** (français, typographiques ou ASCII), avant la normalisation des montants et des contractions. Pas de suppression des guillemets internes ; parseurs des montants toujours ancrés et catégories exactes obligatoires.
- Couverture automatisée : commande de capture exacte, guillemets alternatifs, mot-clé/phrase dictés, ponctuation finale et espaces ; catégories inconnues → clarification sans création, commandes combinées ambiguës → aucune proposition de dépense ; création explicite, budget simple et lot mixte avec guillemets continuent à être reconnus localement. Passerelle testée avec quota et fournisseur qui lèvent une erreur s'ils sont appelés pour cette requête.
- **Preuves :** App integrity CI `44944184269` : **222 tests applicatifs + 2 contrôles complémentaires réussis, 0 échec** ; aucun changement de CSS, confirmation ou logique SQL. Contrôle lecture seule Supabase : RPC de création et lot `SECURITY DEFINER` exécutables uniquement par `service_role`, reçus de lots RLS activée et pas d'INSERT aux clients ; 1 reçu de lot confirmé existait au moment du contrôle.
- Edge Function pilote `smart-assistant` **v28** ACTIVE, JWT obligatoire, six sources exactes comparées au déploiement. Pas de migration, pas d'écriture de test et pas d'opération du foyer personnel. Frontend `assistant-core.js?v=31al` dans l'aperçu isolé. `main` et DA Deep Dark préservés.
- **À valider manuellement avant intégration :** la phrase exacte de la capture doit afficher `Smart Engine · 0 token IA` (non Gemma) ; tests de catégorie inexistante, budget `month` vs `forward`, lot mixte et confirmation réseau après perte de réponse, responsive mobile et dictée sur iOS/Android. Ces vérifications en navigateur ne sont PAS prétendues réussies.



### 31ak — durcissement des confirmations et commandes vocales (21 novembre 2026)
- **Reprise idempotente des lots mixtes après coupure réseau :** si une création de catégorie a été effectivement enregistrée, la réponse perdue ne doit plus transformer le même `requestId` en refus à cause de l'apparition de la catégorie dans le catalogue actualisé. La validation du brouillon exclut temporairement les catégories créées par la demande ; les opérations sur les catégories existantes restent contrôlées et **le reçu SQL atomique reste l'autorité finale**. Un nouvel `requestId` pour le même nom reste soumis au contrôle anti-doublons.
- **Interprétation locale étendue aux expressions vocales non ambiguës**, notamment « J'ai dépensé 50 euros dans la catégorie Gundam », « J'ai payé 50 € en Gundam », « J'ai fait une dépense de 50 euros en Gundam », « 50 euros de dépense en Gundam » : résolution stricte d'une catégorie du foyer déjà disponible, aucun appel IA, aucune création implicite.
- **Sécurité des confirmations côté navigateur :** cas de double clic, édition pendant confirmation, réutilisation du même identifiant de reprise et erreurs définitives vs réseau couverts par tests de non-régression. Pas de nouvelle écriture SQL ni de migration ; aucune création de données fictives pendant cette phase.
- **Preuves :** CI App integrity `44942562477` sur branche `work/v3.1-smart-assistant` : **219 tests applicatifs + 2 contrôles complémentaires, 0 échec**. Les validations de simulation couvrent le rejeu d'un lot lorsque la catégorie apparaît ensuite et une réponse perdue après commit.
- Backend pilote Supabase `smart-assistant` **v27** déployé et actif : JWT obligatoire, allowlist inchangée, six fichiers serveur vérifiés identiques aux sources. Aucune migration de schéma supplémentaire. Les clics manuels en navigateur (notamment coupure réseau et deux confirmations rapides) restent à réaliser ; `main`, le foyer personnel et la DA Deep Dark sont inchangés.



### 31aj — confirmations atomiques de budgets et lots mixtes (21 novembre 2026)
- Confirmations réelles limitées au foyer test individuel autorisé : **fixer**, **augmenter**, **diminuer** un budget en conservant la portée `month` (uniquement ce mois) ou `forward` (à partir de ce mois), ainsi que des lots contenant plusieurs changements financiers.
- Prise en charge d'un lot mixte déjà reconnu par Smart Engine, par exemple « Ajoute 10 € au budget Maison et crée une catégorie Lego avec 60 € » : une seule confirmation enregistre les budgets, créations explicites et éventuelles dépenses/revenus uniques, ou rien.
- Contrat sécurisé du serveur : `confirm_batch`, six champs stricts, authentification JWT Supabase, foyer allowlist, solo slot B, catégorie déjà active et détenue par le foyer, base de calcul en centimes `expectedBeforeCents` lue depuis l'aperçu. Aucun modèle IA n'exécute les montants; seules les cartes validées sont confirmables.
- Migration `20261121195500_smart_assistant_pilot_atomic_batch.sql` appliquée au projet Supabase Budget. RPC service-only `smart_assistant_commit_batch_pilot_v1` avec verrou par foyer, baselines de budget bloquées `FOR UPDATE`, transaction SQL atomique, refus de montants négatifs, conflit sur budget ancien et refus de budgets concurrentiels. Reçus idempotents par `householdId + requestId + hash du lot`, table RLS activée, aucun droit d'insertion pour `anon` / `authenticated`.
- Edge Function pilote `smart-assistant` **v26** active, JWT requis, six fichiers vérifiés identiques. Les scripts de l'interface préparent la même demande à chaque tentative de reprise et n'effacent pas les opérations historiques.
- App integrity 31aj : **213 tests applicatifs + 2 contrôles complémentaires, 0 échec** (run 44941187775). Validation des écritures de budget dans un navigateur authentifié encore nécessaire ; aucune écriture financière artificielle effectuée par l'agent.
- Garantie supplémentaire : une modification « ce mois uniquement » qui tombe exactement sur le début d'un budget `forward` recrée la règle reconduite au premier mois futur disponible. Migration corrective `20261121201000_smart_assistant_pilot_forward_override_guard.sql` installée et vérifiée ; les mois futurs ne perdent donc pas leur budget initial.
- DA Deep Dark inchangée. Foyer personnel et branche `main` inchangés. Les opérations d'épargne et les récurrences de transactions restent en simulation.



### 31ai — budget mensuel reconduit + dépense initiale atomique (21 novembre 2026)
- Contrat métier : une catégorie est active à partir du mois demandé (ou du mois sélectionné), avec un budget `forward` qui s'applique à tous les mois suivants jusqu'à modification explicite. Aucune nouvelle catégorie créée tous les mois. Commandes « à partir de décembre 2026 » et « pour octobre 2026 » reconnues localement.
- Création explicite + dépense initiale unique (ex. « Créer Gundam, budget 100 €, ajoute 50 € de dépense ») : deux objets financiers associés à la catégorie, **une transaction SQL atomique** via `smart_assistant_create_category_pilot_v2`. La dépense n'est pas récurrente.
- Protection de la persistance : authentification et allowlist uniques du foyer test, RPC `SECURITY DEFINER` interdite aux rôles `anon`/`authenticated`, verrou par foyer, contrôle doublon, idempotence `requestId`, budget initial `forward` et transaction initiale facultative créée seulement si l'utilisateur la demande. Toute erreur SQL annule l'ensemble.
- UI : « Confirmer » disponible aussi pour une catégorie + dépense, aperçu de jauge et texte explicite « budget mensuel reconduit », modification désactivée après première tentative de confirmation pour préserver l'identifiant de reprise. DA Deep Dark inchangée.
- Gestion des catégories existante vérifiée : les suppressions par mois ou globales de `js/categories.js` masquent les catégories dans l'état sans enlever leurs transactions ; en base, la FK `transactions_category_id_household_id_fkey` est `ON DELETE RESTRICT`. Aucun code de suppression modifié ; opérations historiques conservées.
- Limite voulue : aucune dépense **future** n'est créée comme déjà réalisée ; si le mois futur est demandé avec une dépense, l'assistant refuse et demande une opération datée réalisable. Les budgets futurs sans dépense sont acceptés.
- Tests Core, serveur, UI et SQL statique ajoutés ; **205 tests automatisés réussis (203 applicatifs + 2 complémentaires, run 44938411873)**. Migration pilote `smart_assistant_category_budget_expense_atomic_v2` appliquée et vérifiée : `anon=false`, `authenticated=false`, `service_role=true`. Edge Function pilote `smart-assistant` **v25** active, JWT obligatoire et 5 fichiers comparés aux sources. Aucune opération de test créée en base par l'agent. Validation navigateur authentifié d'une vraie confirmation encore nécessaire.



### 31ag — fiabilité des écritures et interprétation locale (21 novembre 2026)
- Interprétation locale stricte des dépenses dans une **catégorie nommée et existante** : « ajoute 50 euro de dépense en Gundam » → dépense de 50 €, catégorie exacte Gundam si elle existe et est active ; 0 token Gemma / 0 neurone. Aucune création implicite, aucune catégorisation approximative ; si le nom n'existe pas, réponse de clarification.
- Correction du rappel idempotent des créations après réponse réseau perdue : le texte explicite de création et le brouillon sont vérifiés indépendamment du catalogue actualisé, puis le RPC atomique fait foi pour `same`, `duplicate` ou `conflict` selon l'identifiant de demande. Une création d'un nom déjà présent reste refusée avec un **nouvel** identifiant.
- Les confirmations de transactions existantes conservent l'identifiant déterministe de lot et le contrôle de lecture après écriture. Aucun comportement d'écriture élargi aux budgets, opérations mixtes ou catégories implicites.
- Audit lecture seule de la base Budget : **3 transactions actives** portant une signature Smart Assistant et **0 catégorie / 0 budget** portant `smart-assistant-cat-%` à l'instant de la vérification. Les captures d'aperçu ne démontrent donc pas une création réelle confirmée. Aucune donnée ajoutée ou modifiée pour l'audit.
- Tests ajoutés : expressions exactes, catégories absentes/masquées, rejet des actions enchaînées, zéro appel IA côté passerelle, même `requestId` après actualisation du catalogue et refus des doublons par le RPC. Contrôle navigateur authentifié des confirmations réelles restant à réaliser.
- Ressources du pilote : `assistant-core.js?v=31ag`. Pas de changement de DA, de `main` ni de données personnelles.



### 31af — noir graphite, boutons carrés et création explicite dans le foyer de test (21 novembre 2026)
- Correction du micro et de l'envoi : boîtes `2.75rem × 2.75rem`, `box-sizing:border-box`, `display:grid;place-items:center`, padding nul, SVG centré, réduction cohérente sur très petit mobile.
- Design « gris graphite » (pas de fond violet) dans `native-dark.css` : fond `#0d0e10`, surface `#181a1d`, secondaire `#222428`, surélévation `#2b2e33`, bordures `#373a3f`, violet de marque `#5c29d6` réservé aux accents. Suppression du halo violet dans le fond.
- Cache revu : `assistant-core.js?v=31af`, `live-ui.js?v=31af` et `native-dark.css?v=31af` pour charger les règles réelles et éviter la copie 31aa qui appelait Gemma pour « quatre-vingt-dix euros ». Le moteur courant reconnaît la formulation orale avec 0 token IA.
- Activation **conditionnelle** d'une création réelle de catégorie (budget initial compris), uniquement après demande explicite de création et clic `Confirmer` dans le foyer pilote solo autorisé. Une dépense simple ne crée jamais de catégorie ; les demandes mixtes, catégories + dépense et modifications de budgets restent en simulation.
- La fonction `smart_assistant_create_category_pilot_v1` est `SECURITY DEFINER` **révoquée à `anon` et `authenticated`**, exécutable seulement par `service_role`, et vérifie qu'il s'agit d'un foyer individuel à un seul membre B. Verrou transactionnel par foyer, refus des catégories actives homonymes, idempotence par `requestId` et insertion atomique catégorie + budget `forward`.
- Migration `20261121183000_smart_assistant_pilot_category_creation.sql` appliquée au projet Supabase Budget, rôles vérifiés (anon=false, authenticated=false, service_role=true). Edge Function `smart-assistant` v23 active, JWT requis, cinq sources comparées aux fichiers déployés.
- Tests : App integrity sur la branche : **194 tests applicatifs + 2 complémentaires réussis**, dont 31af catégorisation explicite/verbale, refus d'une création implicite, RPC et rappel idempotent, géométrie icônes et thème sombre. Pas de test navigateur authentifié de confirmation réelle effectué par l'agent.
- Production `main` et foyer personnel inchangés. La publication `/v3.1/live/` est isolée ; validation manuelle de l'apparence et de la création réelle par l'utilisateur avant toute extension.



### 31ae — refonte deep-dark de tout le pilote Smart Assistant (21 novembre 2026)
- Couche `preview/assistant/live/native-dark.css` chargée **après** les styles historiques uniquement dans `preview/assistant/live/index.html` ; aucun changement des pages principales Smart Budget ni de la logique financière.
- Système de design unifié, inspiré du rendu des cartes de la conversation et reconstruit en CSS standard (composants ChatGPT non directement exportables) : fond nuit bleuté `#0a0c13`, surfaces `#161a24` / `#1f2430` / `#252b39`, bordures `#343a49`, texte `#f4f5fb`, accent de marque conservé `#5c29d6`, indicateurs positifs `#79d6a8` et négatifs `#ff929e`.
- Application cohérente au bandeau de marque, formulaire de connexion, carte du foyer/quota, hero, suggestions, compositeur/micro/envoi, texte soumis et réponses, toutes les opérations (dépenses, revenus, budgets, catégories et mélanges), jauges, contrôles de confirmation/édition et panneau des règles.
- Alignements centraux, grilles icône / libellés / montant, barre et labels symétriques, rythme d'espacement relatif en rem, breakpoints mobiles, contraste, focus clavier et respect de `prefers-reduced-motion`. Pas de font externe, pas de nouvelle dépendance JavaScript.
- Validation : suite `App integrity` de la branche réussie (run 44933775815) après test de couverture du thème/contrastes. Revue visuelle manuelle en navigateur encore nécessaire ; fichier CSS de démonstration publié uniquement sous `/v3.1/live/`.
- `main`, le foyer personnel et Supabase inchangés. Actions catégories/budgets toujours en simulation ; transactions ponctuelles existantes inchangées. Prochaine étape : comparer captures utilisateur sur desktop et mobile puis affiner avant d'étudier une migration à tout Smart Budget.



### 31ad — clarification sans exemple fictif et rafraîchissement du pilote (21 novembre 2026)
- Retrait de la phrase de repli « Crée une catégorie Lego avec un budget de 60 euros ». Quand la demande de création est ambiguë, réponse générique demandant le **nom de la catégorie** et le **budget en euros**, sans proposition d'écriture.
- Pour « Créer la catégorie Restauration, Fast Food avec une valeur de cent euros », recherche stricte sur le catalogue du foyer authentifié ; si la catégorie « Restaurants / fast-food » y existe, retour « Cette catégorie existe déjà dans le foyer ». Synonymie limitée à cette dénomination composée, sans fusion de catégories arbitraires.
- Capture utilisateur Gundam affichait un composant antérieur sans jauge : le rendu 31ac contient déjà `mixedBudgetBar` et `pilot-exp-budget-track` pour les créations isolées, mais le navigateur montrait l'ancienne version ; mise à jour de l'empreinte du script `live-ui.js?v=31ad` et fournir une URL de page versionnée pour purger l'HTML en cache.
- CI avec 184 tests applicatifs + 2 complémentaires passés (run 44932687150) ; nouveau test de refus explicite et reformulation générique.
- Edge Function pilote Supabase `smart-assistant` v22 active `verify_jwt=true`; quatre fichiers vérifiés identiques aux sources. Maintien du mode simulation pour budgets et catégories, sans toucher `main` ni au profil personnel.

### 31ac — cartes de nouvelles catégories et refus strict des doublons (21 novembre 2026)
- Le pilote rend une création de catégorie seule (ex. Gundam 90 €) dans une carte `pilot-op` identique aux dépenses habituelles, avec icône à gauche, montant à droite, barre de budget initial et 0 € utilisés si aucune dépense n'est demandée. Une dépense explicitement prévue est reflétée dans l'aperçu.
- Correctif de sécurité sémantique : une demande « Crée une catégorie Lego » ne peut plus être transformée en modification du budget d'une catégorie existante. Le moteur répond qu'elle existe déjà et refuse toute action, en comparant les noms normalisés du catalogue du foyer récupéré sous JWT/RLS.
- CI complète sur branche de travail : 183 tests applicatifs + 2 tests complémentaires réussis (run 44932121208). Tests DOM de l'affichage et tests de non-régression des doublons ajoutés.
- Edge Function pilote `smart-assistant` v21 active, `verify_jwt=true`, fichiers serveur comparés et identiques aux sources. Toujours aucune création de catégorie ou écriture de budget réelle ; simulation exclusivement sur ces actions.
- La préversion GitHub Pages `/v3.1/live/` reste isolée, `main` et production inchangées. Essais manuels de cette dernière carte encore à réaliser.

### 31ab — restauration de la revue et tests de préconnexion (21 novembre 2026)
- Cause de « Communication interrompue » après affichage des cartes : affectation de variables non déclarées `cancel` et `ok` en strict mode dans le pied de la revue mixte ; correction et différenciation erreur de rendu / erreur réseau.
- Suppression du rendu spécial `pilot-category-card` des commandes mixtes : réutilisation des cartes `pilot-op` 31z, pictogrammes, montants et variations alignés à droite, contrôles Modifier compacts, barre du budget et progression réelle de la catégorie existante lue sous RLS ; catégorie nouvelle à 0 dépense simulée.
- Simulation complète avec Annuler et Simuler, sans nouvelle écriture réelle. Statut du Smart Engine rétabli.
- Test de rendu DOM simulé des deux cartes, présence du bouton Simuler, jauge et clic sans exception, plus suite App integrity CI réussie (run 44931268107).
- Lecture seule de la structure Supabase et des politiques RLS pour évaluer une future confirmation atomique catégorie+budget. Risque identifié : `budgets` contient des règles `month` et `forward`, et synchronisation côté application requiert un contrat transactionnel idempotent ; **aucune activation d'écriture mixte avant cette protection**.
- Publication dédiée `/v3.1/live/` à synchroniser après CI, sans changement `main` ni foyer réel.

### Correctif 31aa — interprétation des budgets et créations (21 novembre 2026)
- Signalement test 31z : « Ajoute 10 euros au budget maison et crée une catégorie Lego avec un budget de 60 euros » renvoyait à tort deux remplacements de budgets existants.
- Le moteur déterministe produit désormais un lot mixte de revue `mixedDraft` : augmentation du budget Maison existant de 10 € (calcul sur base lue) et création indépendante d'une catégorie Lego avec 60 € ; jamais de modification du budget parent Loisirs.
- Les demandes explicites de création de catégorie avec budget unique passent localement ; demandes mixtes ambiguës bloquées par une clarification, pas déléguées à Gemma pour créer une modification incorrecte.
- Boulangerie → Courses ; Décathlon → Vêtements par défaut ; achat explicitement lié à l'escalade → Loisirs ; commerçant inconnu = catégorie non déterminée.
- Revue dédiée : deux cartes séparées avec indication de création/variation et simulation exclusivement, modification autorisée, validation stricte. Aucune nouvelle écriture de budgets ou catégories.
- CI App integrity réussi à partir de `cc028a4754b6f0beb31d84969298731e4d4c7710` (run 44930266223), 180 tests automatisés ; non-régression des commandes critiques. Tests navigateur réels encore à faire.
- Edge Function `smart-assistant` v20 active sur le projet pilote `budget-foyer` ; `verify_jwt=true` et quatre fichiers comparés intégralement aux sources. Branche `main` inchangée.
- Publication isolée GitHub Pages `/v3.1/live/` à synchroniser après validation du code ; aucune modification des finances personnelles ni de l'application de production.


- Base develop : 463ae1b4beafbf96fc47d4fc16972dd434a181ea ; branche work/v3.1-smart-assistant.
- Premier lot : interface de laboratoire, palette violette, contrat de validation et consultations bornées, dictée selon navigateur. Aucune écriture financière par l'assistant.
- Passerelle IA préparée côté Supabase : auth + adhésion RLS, catalogue reconstruit côté serveur, listes positives de comptes/foyers de test, modèle configurable et garde quota fail-closed. Non déployée ; RPC de quota et identifiants manquants.
- Planificateur pur de lots confirmés et banc de 200 scénarios FR fictifs préparés ; pas raccordé aux écritures réelles. Tests de contrat et runner live limité, non exécuté avec fournisseur.
- Conversation courte : deux échanges transitoires maximum, réinitialisation, historique revalidé serveur avant quota, aucun enregistrement. Tests simulés ajoutés ; comportement réel à évaluer.
- À terminer : quota durable, benchmark français réel, intégration de la synchronisation et confirmation sur foyer isolé, mémoire RLS, revue visuelle de la palette et tests navigateur.
- Identité : logo SVG d'origine recoloré et déclinaisons PNG/ICO PWA régénérées ; tests statiques, décodage des images et contraste. Revue visuelle réelle à faire.
- UI trois suggestions, dictée continue best-effort et changement de modèle préparés ; secrets renseignés selon le propriétaire, non vérifiés. Aucune activation serveur.
- Aperçu demandé : laboratoire autonome sur foyer fictif, sans Supabase, validateurs et planificateur réels, simulateur local explicitement indiqué. Publication sous /v3.1/ après check ; production inchangée.


## Correctif V3.0.2 — zoom des champs iOS et tablette

- Branche : `work/v3.0.2-touch-input-focus` issue de `develop` (V3.0 + correctif Historique V3.0.1).
- Périmètre : CSS global mobile et tactile à 16 px minimum sur les champs éditables, maintien des grands montants et du zoom manuel. Aucune modification JavaScript métier, SQL ou Supabase.
- Validation prévue : tests `App integrity`, PR vers `develop`, PR distincte issue de `main`, publication ciblée dans la racine GitHub Pages. Versions archivées et previews inchangées.


## Correctif V3.0 — recherche de l'historique sur iPhone

- Branche : `work/v3.0.1-history-ios-focus` depuis `develop`, après fusion V3.0.
- Correction ciblée : `#historySearch` en 16 px sur mobile afin d'éviter le zoom automatique Safari iOS, sans désactiver le zoom du navigateur.
- Source financière et synchronisation Supabase inchangées, fichier CSS versionné dans `index.html` pour forcer son actualisation.
- Validation demandée : App integrity, PR vers `develop`, PR distincte vers `main`, puis mise à jour de la racine `gh-pages` en préservant les snapshots.


## Livraison — V3.0 Motion / UX

- Branche source : `work/v3.0-motion-ux` issue de `develop` (socle V2.9).
- PR d’intégration : [#40](https://github.com/nishiosxn/budget-app/pull/40), vers `develop`.
- Fonctionnalités : logo animé à progression fluide, écran de chargement unique, skeletons, transitions, compteurs, courbes interactives, meilleure lecture des abonnements. Les trois cartes supplémentaires d’accueil ont été retirées après retour utilisateur.
- Préversion validée par l’utilisateur le **17 novembre 2026** : https://nishiosxn.github.io/budget-app/v3.0/
- Dernier contrôle automatique avant la demande de publication : **App integrity réussi** sur `df65d2a61311991f2667ae2902618ff770ffe51b`, run [43981314800](https://github.com/nishiosxn/budget-app/actions/runs/43981314800).
- Authentification, écritures financières, synchronisation, RLS, migrations et sauvegardes Supabase inchangées par le lot V3.0.
- Livraison demandée : fusion PR #40 → `develop`, PR de release distincte → `main`, publication de la racine de `gh-pages` après checks, préservation des snapshots et des previews antérieurs.
- Le déploiement de la préversion ne remplace pas des tests manuels de reprise d’une base ; aucune restauration de production n’est requise ici.

## État

- Dépôt : `nishiosxn/budget-app`
- Version du code : `V3.1`
- Branche de développement de référence : `develop`
- Production du code : `main` → V2.8.1.
- Publication : `gh-pages`.
- Version V2.6 publiée : https://nishiosxn.github.io/budget-app/v2.6/
- V2.8.1 publiée à la racine de GitHub Pages. V2.9 est isolée sur `work/v2.9-history-safety`.
- Pour l'état exact de la branche temporaire, des PR et des checks, consulter GitHub plutôt que considérer ce fichier comme un journal de branches.

## Socle V2.5.1 à préserver

- Synchronisation cloud directe Supabase ; aucun cache financier persistant utilisé comme mode de travail.
- Baseline de session uniquement en mémoire.
- Fusion optimiste locale/cloud et conflits explicites sur les mêmes champs.
- Protection par `updated_at` et déduplication via les index `(household_id, legacy_id)`.
- Realtime, relance manuelle de synchronisation, authentification, invitations, RLS et administration existantes.
- PWA installable sans fallback financier hors ligne.
- Logo/icônes Smart Budget et interface V2.5.1 conservés.
- Les migrations V2.4/V2.5 déjà versionnées et appliquées restent inchangées.

## Workflow

Les branches permanentes sont `main`, `develop` et `gh-pages`. Les nouveaux lots partent de `develop` sur une branche temporaire `work/vX.Y-<lot>` ou `work/vX.Y.Z-<lot>`, avec Draft PR, **App integrity**, validation puis nettoyage après merge. Les versions validées sont conservées par tags immuables plutôt que par branches permanentes.

La branche historique `v2.5.1` sert de source à ce lot de migration. Après intégration validée et création du tag `v2.5.1`, elle pourra être supprimée avec les autres branches historiques.

## Lot précédent — V2.7 Stabilisation

- Branche : `work/v2.7-stabilization`
- Base : `develop`
- Objectif : stabiliser la V2.6 publiée avant promotion V2.7 : restauration des catégories, création d’épargne, sauvegarde/reset complets, picker couleur Paramètres, unités relatives, batching cloud sûr et alignement Git/Supabase.
- Critères d’acceptation :
  - montant réel directement cliquable ;
  - détail dépliable des opérations de chaque catégorie avec libellé, date, montant et payeur individuel ;
  - montant prévu directement cliquable ;
  - action individuelle « réel = prévu » en un clic quand elle est pertinente ;
  - actions secondaires regroupées derrière un menu `⋯` ;
  - suppression toujours confirmée ;
  - « Tout remplir » remplacé par un comportement sûr qui ne remplace pas un réel déjà saisi ;
  - « Tout vider » retiré du premier niveau visuel ;
  - lisibilité desktop/mobile améliorée, avec zones tactiles confortables ;
  - synchronisation et historique des ajustements inchangés ;
  - « Reste disponible ce mois » reste basé sur les montants réels du foyer ;
  - Répartition du mois affiche un solde personnel calculé à partir d’un solde d’ouverture mensuel et de l’attribution unique Baptiste / Anaëlle / À deux ;
  - solde d’ouverture éditable par personne sans être compté dans les revenus ;
  - aucune seconde notion de « compte débité/crédité » ;
  - dépenses « À deux » réparties 50/50 ; Baptiste ou Anaëlle = 100 % pour la personne choisie ;
  - épargne principale affichée sur le mois, avec cumul en secondaire.
- Exclusions : Historique et Suivi restent fonctionnellement inchangés ; les formules de budget prévues/réelles restent inchangées. Une table Supabase dédiée aux soldes d’ouverture a été ajoutée avec RLS par foyer.
- Validation prévue : `node --test scripts/validate-docs.test.mjs`, `node scripts/validate.mjs`, **App integrity**, puis validation visuelle utilisateur avant sortie du Draft.
- État : implémentation terminée sur la branche.
- Validation automatique : **App integrity** réussi sur le commit applicatif `c1a6f9fa4c39316ce337bdc17c8cbdf9d8886917`.
- Migration Supabase `v2_6_account_opening_balances` appliquée, ainsi que son ajout à la publication Realtime.
- Donnée initiale : solde d’ouverture Baptiste pour septembre 2026 = **108,18 €** ; Anaëlle reste non renseignée.
- Septembre Baptiste reconstruit depuis le relevé Boursobank en opérations détaillées : **1 073,64 € attribués en revenus**, **1 051,63 € attribués en dépenses**, solde final vérifié **130,19 €**.
- Catégorie `Aldi` archivée ; l’opération Aldi de 7,96 € est rangée dans `Courses` avec son libellé. Catégorie `Dons` créée pour Fondation de France.
- `Courses` : attribution **Baptiste** uniquement en septembre 2026, puis retour **À deux** à partir d’octobre.
- Erreur 403 Supabase sur les mises à jour de catégories corrigée : le moteur de synchronisation ne tente plus de réécrire la colonne `categories.type` lors d’une modification normale.
- Carte verte « Reste disponible ce mois » simplifiée : total foyer à gauche, reste réel Baptiste/Anaëlle à droite sur desktop et empilé proprement sur mobile.
- Catégories : petite flèche sur les catégories ayant des mouvements ; ouverture d’une liste locale des opérations du mois. Le payeur est lu sur chaque transaction, pas sur le total de la catégorie.
- Vérification live : l’opération Courses de **6,52 €** du 5 octobre est bien enregistrée individuellement avec Baptiste comme payeur.
- Validation utilisateur : autorisation explicite de publier V2.6 reçue après validation de la preview.
- Preview : https://nishiosxn.github.io/budget-app/previews/pr-23/
- Source applicative publiée : `3ed291c8912c601092d87cab8f6a0900378ba3f3`.
- Commit `gh-pages` de la preview : `d685e7b394a99f928828713edc3ce86d32b23227`.

## Lot courant — V2.8 Mobile UX

- Branche : `work/v2.8-mobile-ux`, issue de `develop`.
- PR brouillon : https://github.com/nishiosxn/budget-app/pull/30
- Périmètre : navbar tactile à cinq emplacements, bouton + flottant, ajout dépense/revenu via la modale existante, panneau de saisie mobile, date d'opération modifiable dans le mois choisi, accueil mobile réordonné, restauration du zoom natif.
- Exclusions : calculs financiers, données Supabase, migrations et publication en production.
- Vérification : `node scripts/validate.mjs`, check **App integrity**, tests visuels iPhone/Android/desktop et saisie d'une transaction de test sur un foyer non personnel.
- État : implémentation sur la branche ; **App integrity** réussi pour le SHA source `3aa0b465f0feee7c85529ecf03b458d4fe40ae09`.
- Preview publiée dans la branche `gh-pages` : https://nishiosxn.github.io/budget-app/v2.8/
- Commit de publication `gh-pages` : `5d14a322ee0c462db9d6d9b8bb0da799b110db61` ; copie de 38 fichiers applicatifs sans toucher à la racine ni aux snapshots.
- Les tests manuels responsive, le chargement public de la preview et les parcours authentifiés restent à valider.
- Important : la preview utilise le **Supabase de production** ; essais de saisie uniquement sur un foyer de test.

## Lot courant — V2.9 Historique et sécurité

- Branche : `work/v2.9-history-safety` depuis `develop` après fusion de la PR #30.
- Production actuelle : V2.8.1 ; le correctif de synchronisation de l'ordre des catégories a été fusionné (PR #35) et publié dans la racine et les previews actives.
- Incident du 16 novembre : les sauvegardes privées `incident_backup_20261116`, la restauration ciblée et les 6 protections d'écriture Supabase restent inchangées. Le client utilise `x-smart-budget-sync-version: 20261116-hf1`.
- Inclus : historique filtrable et triable, déplacement des opérations ponctuelles, et nouveau tableau d'abonnements et de récurrences en lecture seule dans l'onglet Catégories. Les boutons Modifier/Arrêter ouvrent les modales existantes.
- Exclu de ce lot : nouvelles migrations Supabase, import bancaire, réécriture de la synchronisation, synchronisation offline, sauvegardes automatiques par serveur.
- Tests : App integrity, tests des synthèses d'abonnements (budgets vs mouvements récurrents, actions non destructives), accessibilité et responsive. Préversion mise à jour sur `/v2.9/` avant validation utilisateur.

## Sauvegardes privées V2.9 — lot serveur

- Branche : `work/v2.9-private-backups` depuis `develop`, après fusion de la PR #34 (historique et abonnements).
- Trois migrations SQL enregistrées côté Supabase, fichiers sources alignés sur les versions réelles de migration : `20261116025347`, `20261116025548`, `20261116025626`.
- Schéma privé `smart_budget_backups`, avec contrôle du rôle `postgres` et droits `anon`, `authenticated`, `service_role` refusés ; RLS activée sans politique d'accès client.
- Instantanés des 8 tables, copie cohérente en une lecture MVCC, données archivées incluses. Rétention de 30 jours seulement pour les instantanés planifiés.
- Supabase Cron : tâche `smart-budget-financial-snapshot-every-6h`, horaire `17 */6 * * *` (UTC), active.
- Tests manuels réussis : snapshot #1 (`manual`) et #2 (`scheduled`) complets, 1 060 lignes dans 8 tables, aucune différence détectée avec l'état actuel. Les six garde-fous précédents restent activés.
- La récupération reste manuelle, en transaction contrôlée ; pas de fonction de restauration accessible à l'application. Les snapshots sont dans la même base et ne remplacent pas des sauvegardes externes.
- Runbook : [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md).

## Exports chiffrés GitHub Actions — configuration en attente

- Branche de production `main` : PR #38 fusionnée, workflow `offsite-backup.yml` installé sans toucher à l'application V2.8.1.
- Backport infrastructure V2.9 : ce lot recopie le workflow, le guide Windows et les tests vers `develop`.
- Cron GitHub quotidien à 03:43 UTC, export PostgreSQL 17 de `public`, `smart_budget_backups`, `incident_backup_20261116` directement dans `age`, fichier `.dump.age` conservé 60 jours en artefact.
- La tâche n'exporte rien avant configuration par le propriétaire : `SMART_BUDGET_BACKUP_AGE_RECIPIENT` (variable GitHub) et `SMART_BUDGET_BACKUP_DATABASE_URL` (secret GitHub).
- La clé privée n'est pas transmise à GitHub ni à ChatGPT. Première sauvegarde externe encore à vérifier par un run et un déchiffrement local.
- Les sauvegardes internes (pg_cron) et six protections incident restent inchangées.

## Prochaine action

Faire passer les tests de la PR des sauvegardes, vérifier les avis de sécurité, et laisser la tâche Cron effectuer son premier lancement automatique. Réévaluer ensuite les exports chiffrés hors projet avant d'ajouter une restauration utilisateur.

### Reprise V3.1 — quota pilote
Code de réservation conservative avant inférence et SQL de revue isolé, non appliqué. Aucun appel Cloudflare. Foyer de test et forfait Workers Free à confirmer avant activation ; tests SQL et modèle réel manquants.

### Pilote connecté — migration et interface
Quota installé (`20261117235347`) ; garde permissions/plafonds et zéro résidu vérifiés. La page `preview/assistant/live/` se connecte au compte isolé sans sauvegarde de session, appelle la passerelle, reçoit un résultat revalidé, sans écriture financière. Activation explicite par deux secrets et test réel navigateur encore nécessaires.

### Pilote IA — premières demandes réelles
Plusieurs POST 200 vérifiés, 6 réservations et 917 unités le 18/11 UTC. Fonction v5 identique à la source f2326dd4. Préparation du contrôle des doublons futurs dans le planificateur, écriture toujours désactivée jusqu'à intégration et tests sur foyer isolé.

### V3.1 — proposition immédiate
Prompt et contrat de revue assouplis, catégories absentes explicitement non affectées, variation de budget calculée côté serveur, confirmation locale simulée. Validation stricte d'écriture conservée. Pas de mutation financière.

### V3.1 e — référentiel et cartes
Catégorisation déterministe et indices contrôlés Gemma, propositions de catégories manquantes, revue design et mémoire locale opt-in. Tests de la taxonomie et normalisation ajoutés ; aucune écriture financière.

### 31f — Zara / raccourci sans IA
Chemin déterministe après autorisation, avant quota : dépenses simples et commerces connus, prévisualisation uniquement. Tests ajoutés pour Zara, montant décimal, catégories manquantes et phrases complexes.

### 31g — moteur hybride
Budget relatif/absolu/zéro et alias essence/carburant, opérations familiales simples, sans appel IA, prévisualisation du budget réel quand disponible. Tests ajoutés ; aucune écriture financière.

### 31h — budget et lots
Variantes de budget relatif (course), delta UI, création explicite groupée et consultation historique catégorie en lecture seule. Tests de régression ; aucune mutation financière.

### 31i — demande et Gundam
Correction de la grammaire de création groupée et affichage du texte envoyé en mémoire. Tests de régression et publication pilote à vérifier. Aucune mutation financière.

### 31j — Smart Engine
Normalisation et lot de mouvements déterministes, corpus synthétique 2 000 cas + refus, validation stricte conservée. Publication après CI. Aucun changement des données.

### 31k — DA + consommation
Pilote connecté : composition horizontale, labels superflus retirés, pas de checkbox récurrente, barre quota neutrons estimés via RPC service_role et détail tokens retournés si disponibles. Sans écriture financière.

### 31l — composer compact
Textarea auto-ajustable, aucune hauteur fixe desktop/mobile, aucune poignée native ; redimensionnement lié à la dictée et à la saisie. Tests frontend et voix ajoutés.

### 31m — provenance et épargne
Revenus nommés, épargne et lots mixtes locaux ; badges d'origine, résumé hors transferts, tests. Aucune opération enregistrée.

### 31n — catégorisation personnalisée
Lecture des catégories réelles du foyer à la connexion ; formulaire de règle persisté directement sur ajout, tri par type, correspondance de mots, suppression. Tests spécifiques ; aucune écriture Supabase ni changement moteur.

### 31o — catalogue complet dans l'éditeur de mots-clés
Les cibles affichent le catalogue automatique intégral + catégories spécifiques du foyer sans doublon ; correspondance locale vers catégorie active ou proposition de création lors de la revue. Confirmations simulées.

### 31p — retours terrain
Six captures analysées : catégories explicites produits, date préfixée, phrase dépenses composées, revenu + épargne anaphorique, transfert interne et solde bancaire non connecté. Parsing local, suggestion de catégorie canonique, tests de sécurité ; aucune écriture.

### 31q — libellés contextualisés
Extraction des descriptions explicites pour achats, courses et magasins, affichage séparé du magasin sans ajouter de champ de stockage. Libellé par défaut = magasin ; catégorie guidée par le produit, tests. Aucune écriture réelle.

### 31r — retours tests avec payeurs et pharmacie
Deux payeurs distincts uniquement lorsque tous les propriétaires sont membres du foyer à deux ; le pilote solo retourne une explication au lieu d'une conversion invalide. Pharmacie : libellé contextuel, Santé, date exacte, sans IA. Pas de modification des accès, ni de la production.

### 31s — éditeur de propositions
Éditeur local de cartes et lots groupés, recalcul de budget/solde, retrait d'une ligne, lecture GET du budget si cible/mois modifié, validation et tests. Aucun enregistrement financier ni modification serveur.

### 31t — aperçu budget
Barre par dépense, calcul mensuel existant + lot en cours, nouvelle catégorie sans budget par défaut, définition explicite dans le lot, sélecteur groupé. Tests ; lecture seule et aucune écriture.

### 31u — design system 1.0 et polish des réponses
Charte `docs/SMART_BUDGET_DESIGN_SYSTEM.md`, tokens `preview/assistant/live/design-system.css`, structure minimale et responsive, suppression de bruit, informations critiques conservées, animations éditeur. Smart Engine, Gemma, données et production inchangés.

### 31v — enregistrement réel V1 pilote solo
Lot ponctuel dépenses/revenus catégories existantes seulement ; confirmation insert-only avec JWT/RLS, clé de lot stable et vérification. Les autres transactions et types restent en simulation. Production inchangée.

### 31w — correctif état de confirmation
Libération de busy avant rendu du brouillon valide ; protection d'enregistrement conservée. Test d'exécution du callback, aucune modification Supabase.

### 31x — harmonisation géométrique et charte V1.1
Quota et règles catégorisation alignés sur des insets cohérents, chevron accessible ; design system entièrement documenté pour future refonte globale. Front pilote seulement.

### 31y — Correction du dernier écart inférieur
Retrait du wrapper grid vide et alignement du bouton Nouvelle demande en enfant direct. Nettoyage des pistes vides de résultat et statut, standard réutilisable pour la refonte globale.

### 31z — Protection de consommation IA
Local : achats simples chez toute enseigne non ambiguë sans catégorie inventée, Décathlon reconnu. Edge : sortie plafonnée à 1024 tokens ; réservation conservatrice limitée à 320 neurones internes par prompt, pas d'inférence sur payload trop gros. Tests de limites et non-régressions. Les coûts réels peuvent différer des estimations.
