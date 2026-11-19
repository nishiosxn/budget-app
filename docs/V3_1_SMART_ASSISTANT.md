# V3.1 — Smart Assistant

Statut : chantier isolé. Le frontend de laboratoire ne fait aucune écriture financière et le fournisseur n'est pas activé.

## Plan
1. Violet #5C29D6, logo et thème. Préserver les préférences ; terminer les icônes PNG/ICO et l'audit de contrastes.
2. Proxy IA authentifié, quota durable et modèle configurable. Cloudflare Qwen3 candidat, alternatives selon disponibilité et résultats. JSON toujours revalidé.
3. Dépense/revenu unique ou mensuel, épargne, budget prévu : catalogue réel, centimes entiers, dates exactes, brouillon, confirmation, revalidation, doublons et idempotence, moteur sync existant.
4. Mémoire des associations marchands/catégories, opt-in, RLS par foyer, suppression possible. Aucune migration appliquée ici.
5. Conversation et dictée française ; saisie clavier en secours ; calculs exclusivement par Smart Budget.
6. Benchmark 200 commandes françaises, sécurité, quota, tests d'échec, concurrence et récurrences, vrais tests iOS/desktop sur foyer isolé. Pas de fusion ni publication avant validation.

## Contrat
draft : operations [{kind,categoryId,owner,amountCents,date,label,frequency}], max 12, propriétaires B/A/common, fréquence once/monthly.
query : {kind,query,month,compareMonth,categoryId,owner}, outils summary/categories/transactions/comparison.
clarify : demander une précision ; answer : aide générale, sans chiffres financiers inventés.
Les occurrences scope forward sont comptabilisées par la logique actuelle et ne prouvent pas un débit bancaire.
Seule la session et l'adhésion en base autorisent l'accès. Aucun secret client, SQL arbitraire, paiement, suppression massive, ni mutation côté modèle.
L'interface est un laboratoire, sans écriture, tant que le chemin de confirmation n'est pas validé.

## Sources
- https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/
- https://developers.cloudflare.com/workers-ai/features/json-mode/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/get-started/rest-api/

## Passerelle IA (code préparé, non déployé)

Le handler exige l'activation explicite et les listes positives de foyers et utilisateurs de test. Il vérifie le jeton avec Auth puis le rattachement au foyer sous RLS. Le catalogue envoyé au modèle est reconstruit à partir des catégories et du foyer réellement accessibles ; le corps client n'est pas une autorité. Les montants historiques ne sont pas envoyés. Le seul calcul distant est l'interprétation du prompt ; les requêtes budgétaires sont exécutées localement.

Variables serveur (jamais dans GitHub ni dans le navigateur) : SMART_ASSISTANT_ENABLED, SMART_ASSISTANT_MODEL, SMART_ASSISTANT_CF_ACCOUNT_ID, SMART_ASSISTANT_CF_TOKEN, SMART_ASSISTANT_TEST_HOUSEHOLDS, SMART_ASSISTANT_TEST_USERS, SMART_ASSISTANT_SUPABASE_PUBLISHABLE si nécessaire. Ne rien activer avant le test du quota durable. La RPC reserve_smart_assistant_quota n'est pas installée. Si elle manque ou refuse, aucun appel au LLM n'est effectué. À concevoir et tester dans un projet isolé avec le contrôle des permissions et un plafond journalier global, puis valider les droits avant déploiement.

La réponse de Qwen doit être vérifiée en direct (JSON mode documenté mais compatibilité réelle du modèle à confirmer). Pas de fallback silencieux vers un modèle payant. Les tests actuels utilisent un fournisseur simulé pour contrôler la validation et les chemins 401/403/429/503/422/502 ; ils ne prouvent pas la qualité de compréhension du LLM. Aucun secret n'a été renseigné.

## Préparation de la confirmation et banc d'essai
Le planificateur pur produit un patch en mémoire à partir d'un lot validé, sans modifier son entrée ni appeler saveState. Il transforme les revenus/dépenses uniques ou mensuels et l'épargne dans le format existant, et les budgets dans les stores month/forward. Il rejette les doubles propositions et les identifiants de lot déjà utilisés. Ce module n'est volontairement pas raccordé à un bouton d'enregistrement : avant intégration, vérifier une baseline fraîche, expansion des récurrences pour les mois ciblés, propriétaire du budget à sa date, doublons avec opérations bancaires futures, réutilisation de la synchronisation existante et statut réellement synchronisé.

200 scénarios fictifs FR (20 intentions et 10 formulations) sont disponibles dans scripts/assistant-benchmark-fixtures.mjs. Le test CI vérifie les attentes et leur compatibilité avec le contrat, pas l'interprétation par un modèle. Le runner scripts/assistant-benchmark.mjs n'a aucun accès au foyer et ne fait aucun appel sans --live, confirmation préalable du forfait gratuit et identifiants côté environnement. Limite 10 cas par lancement, arrêt sur erreur, aucune bascule vers un service payant. Exécuter ensuite par lots pour comparer les modèles et publier les scores réels. Aucun benchmark distant n'a été exécuté.

## Logo et identité
Le tracé SVG original est conservé, fond #5C29D6 ; les PNG 192/512/180 et ICO 16/32/48 sont déclinés à partir de la géométrie originale. Les accents par défaut et le loader utilisent le violet, les préférences de compte existantes restent disponibles. Le contraste de la paire icône est testé ; la conformité globale WCAG et les contrôles sur appareils doivent encore être vérifiés.

## Conversations — contexte transitoire
Deux échanges précédents au maximum, uniquement brouillons non enregistrés et précisions, conservés en mémoire de la page. Le bouton Nouvelle demande, la révocation du consentement ou le changement de session/foyer efface le contexte. La passerelle revalide chaque ancien résultat avec le catalogue actuel avant quota et inférence ; contexte invalide refusé. Aucune écriture, aucune mémoire persistante. Les corrections portent sur le brouillon complet. Tests simulés ; compréhension française réelle encore à mesurer.

## Preview isolée
Page de laboratoire dans preview/assistant : foyer fictif en mémoire, simulateur de commandes à choix limité, identifiée comme non-IA. Elle utilise le validateur et le planificateur réels pour les confirmations locales, ne charge aucun SDK cloud, n'a aucun stockage persistant ni authentification. Les tests ne mesurent ni le modèle ni la synchronisation. La dictée, si autorisée, est gérée par le navigateur.

## Interface et dictée
Trois suggestions en ligne au-dessus de la saisie, pictogrammes à gauche. Le laboratoire conserve les autres scénarios en code. Dictée partagée : transcription intermédiaire, relance bornée, chronomètre, arrêt manuel et sur changement de contexte. Tests navigateur réels à faire. Modèle candidat Gemma 4 26B, GLM 4.7 Flash en alternative configurable (aucun fallback automatique). Secrets renseignés par le propriétaire, non vérifiés ; quota durable et foyer de test restent nécessaires avant activation.

## Quota pilote — code à vérifier en base isolée
- Gemma 4 seulement pendant le pilote : estimation réservée avant appel, taille totale 24 000 octets maximum, 1 400 tokens de sortie maximum, marge 50 %. Les alternatives restent désactivées tant que leur tarification n'est pas validée.
- Compteur quotidien global UTC, proposition de 8 000 neurones estimés et 100 appels maximum. Aucune restitution après échec ou interruption ; échec de réservation bloque l'appel. RPC invoker réservée à service_role, table non exposée avec RLS. Auth utilisateur et adhésion au foyer vérifiées séparément avant réservation.
- [SQL de revue non appliqué](smart-assistant-quota-draft.sql) : avant déploiement, tests Postgres (droits anon/authenticated refusés, service_role autorisé, concurrence, limites, invalides, changement UTC), conseiller sécurité et migration créée via CLI.
- Ce compteur n'est **pas** la facturation Cloudflare : autres usages du compte non mesurés ni surcoûts possibles sur un forfait payant. Activation interdite jusqu'à confirmation explicite Workers Free (`SMART_ASSISTANT_FREE_PLAN_CONFIRMED=true`), secrets disponibles et foyer de test isolé. Vérifier l'usage réel dans le dashboard et la compatibilité du modèle avant benchmark.
- Tarification consultée le 18 novembre 2026 : https://developers.cloudflare.com/workers-ai/platform/pricing/ et https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/.

## Pilote connecté — 18 novembre 2026
Migration `20261117235347_smart_assistant_quota_pilot` appliquée sur le projet autorisé : auto-tests invalides/plafonds, permissions, RLS et zéro réservation résiduelle confirmés. Aucune table budgétaire modifiée. Avis sécurité concernant la table : absence volontaire de politique RLS ; aucun accès utilisateur. La preview `v3.1/live/` utilise une session de test éphémère et le vrai endpoint, sans mutation financière ni calcul des consultations. Les deux drapeaux SMART_ASSISTANT_ENABLED et SMART_ASSISTANT_FREE_PLAN_CONFIRMED doivent être `true` pour permettre un appel. Le compte de test est seul autorisé ; contrôle solo et membership unique. Aucun benchmark réel exécuté. La simulation reste disponible séparément.

## Validation réelle du fournisseur et prochaine intégration
Les logs Supabase du 18/11 montrent plusieurs POST 200 et le compteur 6 réservations pour 917 unités estimées. Les trois fichiers de la fonction hébergée v5 correspondent au commit source f2326dd4. Cela confirme l'appel et la validation des réponses, pas encore la justesse sémantique des 200 cas. Le planificateur prépare désormais la liste des mois à relire et vérifie les récurrences proposées sur tout l'horizon (dates de fin de mois plafonnées), y compris les recouvrements d'un même lot. Avant toute écriture, brancher le moteur de synchronisation existant sur le foyer de test, vérifier que les occurrences sont complètes et que le digest et la session restent stables ; limiter le premier essai à une opération unique. Aucun enregistrement connecté ajouté dans ce commit.

## Proposition immédiate — revue sans écriture
Le modèle propose un lot complet en une requête, défaut acteur/date du jour/ponctuel. Catégorie absente : null et sélection locale, jamais une catégorie inventée. Le contrat de revue est distinct du validateur strict d'écriture. Les variations de budget utilisent planMode et un montant en centimes ; le serveur calcule avant/après à partir des budgets du foyer de test, sans transmettre ces montants au modèle. Le pilote propose des cartes compactes et une confirmation simulée sans second appel IA. Les catégories absentes ou budgets sans baseline ne peuvent pas être confirmés. Aucun enregistrement réel.

## Référentiel de catégorisation et revue V3.1 e
Taxonomie 19 familles dans assistant-core (même code partagé côté serveur), alias de catégories et termes marchands. Priorité à une catégorie explicitement demandée/nom exact, association personnelle du pilote, règle connue, catégorie IA existante ; catégorie connue absente = proposition canonique de création (sans inventer un ID). Les ambiguïtés restent modifiables localement. Le modèle peut fournir un indice parmi les clés contrôlées ; le serveur normalise puis valide le brouillon. Aucun assouplissement du validateur d'écriture. Cartes avec pictogrammes, montants signés, variation nette des opérations uniques, contrôle de catégorie masqué par défaut, Annuler/Confirmer. Création et confirmation simulées, pas de mutation Supabase. Règles personnelles éditables ; stockage navigateur facultatif, limité au foyer test, pas de prompts, montants ou identifiants de session. Synchro de la mémoire et vraie création de catégorie à intégrer plus tard. Cache-busting des ressources du pilote.

## Correctif 31f
Le 18/11, POST 422 observé pour le pilote après signalement Zara. Le contenu exact de la réponse invalide n'est pas journalisé. Ajout d'un chemin déterministe strict pour les phrases complètes de dépense unique auprès d'enseignes connues, après vérification du foyer, avant réservation et inférence. Aucun appel IA ni quota pour ce chemin. Les formulations complexes passent toujours par Gemma. Proposition Zara → Vêtements (création simulée si absente). Tests de régression et refus des phrases composites. Aucun enregistrement réel.

## 31g — moteur hybride étendu
Commandes de budget intégrales avec alias exacts du catalogue et référentiel : augmenter/diminuer/fixer/zéro, mois sélectionné par défaut, récurrence explicite. Calcul côté serveur sur montant actuel et autorisation inchangée. Dépenses connues et virements maman/papa simples également avant quota. Commandes composites et inconnues restent au modèle. Les montants manquants, catégories ambiguës et opérations non reconnues ne sont pas inventés. Prévisualisation uniquement, aucun enregistrement. Plusieurs POST 422 constatés le 18/11 ; pas de réponse brute conservée, cause détaillée modèle non démontrée.

## 31h — intentions composées et consultation
Correction augmente de + singulier course, affichage montant précédent → nouveau et variation calculée. Création explicite avec budget et dépense dans un seul brouillon déterministe, sans ID inventé ni écriture ; une catégorie existante est réutilisée. Lecture du mois précédent pour une catégorie de dépenses active, montant prévu réel et opérations enregistrées incluant les récurrences selon les règles du client ; pas de transfert au modèle. Absence d'historique/catégorie ou lecture non disponible signalée sans chiffres inventés. Le pilote confirme uniquement en simulation ; la grammaire des demandes composées n'est pas universelle.

## 31i — demande visible et catégorie Gundam
Le pilote conserve la demande envoyée au-dessus du statut et des réponses, y compris en cas d'erreur, en mémoire seulement. Le brouillon composé accepte plusieurs phrases, le préfixe « catégorie budget », les montants décimaux et « ajoute une dépense de ». Aucune interprétation partielle si une clause n'est pas reconnue. Carte de catégorie avec barre de consommation et reste. Tests Gundam 90/40/50 et absence de quota. Toujours en simulation.

## 31j — Smart Engine
Normalisation monétaire française (nombres en lettres, centaines, milliers, euros/balles), synonymes bornés, ponctuation de création dictée, dates hier/aujourd'hui, lots de dépenses et revenus familiaux reconnus intégralement. Texte original conservé. Le moteur refuse une correspondance partielle et utilise Gemma pour les autres commandes. 2 000 cas synthétiques distincts générés et vérifiés sémantiquement (montants, catégories, dates, intentions) ; tests de rejet supplémentaires. Ce n'est pas une mesure de couverture du français libre ni un benchmark réel de Gemma. Aucune écriture financière.

## Pilot UX 31k — 19 novembre 2026
Design compact aligné Smart Budget : textarea et boutons micro/envoyer sur la même ligne, sans case de consentement récurrente. Une information concise sur le traitement par Cloudflare reste visible, et aucun prompt n'est envoyé automatiquement. Quota persistant affiché sous foyer connecté : suivi serveur des neurones réservés / 8000 par jour UTC, lecture protégée par JWT, allowlist foyer et RPC service_role invoker exclusivement. Dernier prompt : tokens exacts si Cloudflare retourne usage, sinon indisponibles ; quota interne en neurones estimés, distinct des tokens et de la facturation Cloudflare. Les commandes Smart Engine affichent 0 token IA et 0 neurone. Aucun enregistrement financier.

## 31l — Champ compact et hauteur automatique
Textarea à une ligne, hauteur initiale 42px, aucune poignée de redimensionnement. Croissance selon `scrollHeight` sur frappe, collage, sélection de suggestion, dictée (callback optionnel de transcription) et remise à zéro, plafonnée à 180px avec défilement au-delà. Boutons inchangés en vis-à-vis du champ. Aucune modification des opérations ou du quota.

## 31m — provenance et épargne distincte
Après authentification, Smart Engine reconnaît les revenus simples de personnes nommées, les économies ponctuelles et les lots mixtes en une seule requête déterministe. Noms des personnes = libellés, jamais propriétaires déduits. Nouvelle famille catégorie Épargne ; catégorie existante prioritaire, création suggérée dans le pilote si absente. Source affichée visiblement sur la réponse (Smart Engine 0 token IA ou Gemma 4 + tokens mesurés). La mise en épargne est présentée en transfert positif vers l'épargne, séparée du net revenus / dépenses ; aucun virement bancaire réel. Reconnaissance partielle refusée et aucune écriture budgétaire.

## 31n — Associations personnelles de catégories
Le sélecteur charge dès la connexion toutes les catégories autorisées du foyer avec JWT et RLS via lecture seule `/rest/v1/categories`. Les catégories sont regroupées en Dépenses, Revenus et Épargne. Ajout « mot-clé / enseigne → catégorie réelle » sauvegardé immédiatement dans ce navigateur (ancienne mémoire opt-in compatible), modification par réassociation, suppression individuelle ou globale. Correspondance sur mots entiers, priorité au mot le plus précis, pas de catégorie incompatible ou inactive, uniquement dans l'aperçu de brouillon. Les règles automatiques sont repliées. Aucune modification de base ou du moteur IA, ni synchronisation inter-appareils.

## 31o — Sélecteur identique aux règles automatiques
Le menu de création d'association affiche désormais **toutes les familles de `SmartBudgetAssistantCore.categoryRules`**, même lorsque le foyer test ne les a pas activées, et ajoute sans doublon les catégories personnalisées existantes du foyer. L'association conserve un identifiant sémantique `rule:<key>` ou `id:<category>` en mémoire locale (avec rétrocompatibilité des anciens IDs). Lors de la prévisualisation, un mot-clé résout d'abord vers la catégorie correspondante active ; si elle n'existe pas, il propose la création canonique sans inventer d'ID ni enregistrer quoi que ce soit. Aucun changement des opérations réelles ou de la passerelle IA. Les règles sont locales au navigateur.

## 31p — six retours de tests terrain (19/11)
- Reconnaissance déterministe et sans IA des dépenses contextuelles : `Hier, j’ai mis 30 € d’essence à Total` (Carburant, J-1), `J’ai acheté un LEGO à 39,99 € chez King Jouet` (Loisirs), phrases mixtes `J’ai fait 28 € de courses chez Lidl et acheté 12 € de produits ménagers chez Action`.
- Référence à un revenu dans une même phrase : `J’ai reçu 75 € de mon père, mets-en 25 de côté` → revenu + mise en épargne, sans consommation IA. Le montant épargné ne peut pas excéder le revenu immédiatement cité par « en ».
- `J’ai transféré 200 € de mon compte courant vers mon livret A` → catégorie Épargne, transfert interne, jamais une dépense. Questions sur le solde bancaire réel → réponse explicite sans appel IA et sans chiffres inventés.
- En repli Gemma, suggestion sémantique sur une seule opération et un seul montant si l'indice de catégorie est omis. Priorité aux catégories déjà existantes via alias. Ne pas inventer de catégorie au nom du magasin ; proposer une nouvelle catégorie uniquement si la famille canonique n’existe pas dans le foyer.
- Les données financières et la version principale ne sont pas modifiées ; pilote et confirmations simulés. Tests automatisés séparés, pas de preuve de couverture exhaustive du langage naturel.

## 31q — Libellé contextuel des dépenses
L'enseigne et la description explicite sont conservées dans le champ financier `label` sous la forme `Enseigne · Libellé` pour rester compatible avec le contrat actuel. L'aperçu affiche l'enseigne sur la ligne principale et « Libellé : ... » seulement si la description a été donnée. Exemples : McDo sans produit → `McDonald's` seul ; Lidl, courses du mois / de la semaine → libellé temporel uniquement s'il est explicitement mentionné ; Décathlon, chaussures d'escalade → `Décathlon · Chaussures d'escalade`. Le produit explicite détermine la catégorie en priorité sur l'enseigne. Aucune date ou périodicité inventée, aucune écriture financière, confirmations simulées.

## 31r — Propriétaires distincts et achats de pharmacie
Une phrase multi-payeurs explicite (« Anaëlle a payé 45 € de courses et moi 17 € de bus ») est interprétée uniquement lorsque les deux payeurs sont résolus dans les noms de membres fournis par le serveur et que le foyer n'est pas solo. L'acteur reste le payeur des « moi ». Le pilote connecté force un foyer individuel : au lieu d'émettre une proposition invalide ou de consommer un appel Gemma, l'assistant donne une réponse explicite sans aucune opération et sans IA. Aucune élévation d'autorisation, aucun changement de règle de foyer. L'expression « Note 23 € de médicaments achetés à la pharmacie le 6 novembre » devient une dépense Santé de 23 € au 06/11 avec libellé Pharmacie · Médicaments. Dates invalides ou futures refusées, Santé absente proposée et non créée. Tests de régression et validation fail-closed. Aucun enregistrement financier.

## 31s — Éditeur de propositions (pilote)
Chaque opération peut être modifiée sans nouvelle inférence : nom, libellé, montant, catégorie réelle ou famille absente proposée, date/mois, payeur autorisé, fréquence et type de variation d'un budget. Un lot peut être réduit sans supprimer de donnée financière. Calculs en centimes, contrôle des doublons et de la disponibilité du mois/catégorie ; confirmation bloquée tant que brouillon incomplet ou éditeur ouvert. Budget : montant précédent du serveur réutilisé uniquement pour même catégorie/mois, sinon lecture GET catégories/budgets sous JWT et RLS (aucune écriture, aucune inférence), refus si non disponible. Les catégories groupées peuvent modifier nom, budget, dépense et mois selon les limites du contrat actuel (dépense datée du jour et même mois, propriétaire acteur). Les corrections restent dans le brouillon ; mémoire automatique reportée au lot dédié, règles manuelles conservées. Aucun changement au moteur, au serveur ou à la production. Les confirmations restent simulées.

## 31t — Aperçu de budget sous les dépenses
Sélecteur groupé catégories existantes / catégories à créer. Aperçu du mois de chaque dépense : budget prévu, consommé après l'ensemble des dépenses proposées de la même catégorie/mois, reste et barre. Lecture GET sous JWT/RLS des budgets, transactions et récurrences, même calcul `categoryReport` que les consultations du pilote. Les lectures sont mises en cache par catégorie/mois dans le brouillon ; changement de catégorie/date charge une autre clé. Données indisponibles ou projections conflictuelles ne donnent pas de chiffre inventé. Pour une nouvelle catégorie, aucun budget n'est supposé : bouton Définir un budget qui ajoute une proposition explicite de budget au lot, pas d'écriture. Les changements de budget du lot sont pris en compte pour le même mois ; les budgets récurrents inter-mois non résolus restent indisponibles. Confirmation toujours simulée et aucune inférence supplémentaire.

## 31u — Charte et polish UI
Voir `docs/SMART_BUDGET_DESIGN_SYSTEM.md` et `preview/assistant/live/design-system.css`. Tokens CSS réutilisables, palette neutre claire/sombre, rayons concentriques, 44px zones tactiles, typographie native, carte sans double encadré, bloc budget sans libellés répétitifs, mention groupée des créations, masquage des agrégats redondants, actions compactes, éditeur motion 200/160 ms avec réduction de mouvement. Les règles/validations, projections et confirmations simulées restent inchangées. Vérifier visuellement sur navigateur, mobile et desktop ; aucune prétention de certification WCAG.
