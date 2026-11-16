# Livrable QUALITE.md — CineSlot

## 1 · LES MESURES (ÉTAPES 2 ET 3)

| Projet | Lignes | Sécu. | Fiab. | Maint. | Couverture | Dupl. | Porte |
|---|---|---|---|---|---|---|---|
| back | 996 | A | A | A | 20.6 % | 0.0 % | Passed |
| front | 5667 | A | A | A | 45.3 % | 1.5 % | Passed |

---

## 2 · LES PROBLÈMES (ÉTAPES 4 ET 5)

| # | Problème (fichier:ligne) | Règle | Décision et raison | Preuve |
|---|---|---|---|---|
| 1 | `backend/src/services/slotService.js:224` | `javascript:S2245` (Sécurité - Hotspot) | **Faux positif / Accepté** : L'utilisation de `Math.random()` est circonscrite au tirage aléatoire d'un film pour générer des séances de démonstration (`createDemoSlot`). Aucun enjeu cryptographique, de jeton ou d'entropie sensible. | Déclaré et revu comme hotspot à faible risque contextuel. |
| 2 | `backend/src/server.js:19` | `javascript:S3358` (Maintenabilité) | **Corriger** : Extraction de l'opérateur ternaire imbriqué (`os.availableParallelism ? ... : ...`) dans une constante dédiée `defaultCPUs` pour clarifier la lecture et l'affectation de `numCPUs`. | Commit `694141c` ; 19 problèmes avant, 18 après ; statut `CLOSED FIXED` constaté le 29/10/2026 à 16:52. |
| 3 | `frontend/src/composables/useAccessibleDialog.ts:1` | `typescript:S1128` (Maintenabilité) | **Corriger** : L'importation de `ref` depuis le paquet `'vue'` n'était jamais utilisée dans le fichier. Suppression de l'import pour assainir le code mort. | Commit `4b6c0bd` ; 29 problèmes avant, 28 après ; statut `CLOSED FIXED` constaté le 29/10/2026 à 16:54. |
| 4 | `frontend/src/composables/useSlots.ts:288` | `typescript:S1186` (Maintenabilité) | **Accepter avec raison** : La fonction fléchée vide `const updateSlotLists = () => {};` est un stub déprécié conservé temporairement afin de préserver la compatibilité ascendante de l'API publique du composable avec les anciens composants consommateurs. | Problème maintenu avec justification technique (stabilité de l'API interne). |
| 5 | `frontend/src/stores/slots.ts:46` | `typescript:S4043` (Maintenabilité) | **Accepter avec raison** : Le tri in-place (`.sort()`) sur le tableau des créneaux dans le store Pinia est volontaire et confiné à la mutation contrôlée de l'état réactif local, sans incidence sur des objets immuables externes. | Problème accepté avec raison fonctionnelle (contexte Pinia). |
| + | non vu par SonarQube : `frontend/src/components/SseStatus.vue` / composables de réservation | aucune | **Revue humaine** : Absence de gestion visuelle ou de bannière d'échec immédiat pour l'utilisateur en cas de perte de flux SSE lors d'une tentative directe de réservation de séance. L'analyse statique valide la syntaxe mais ne détecte pas le manque de retour d'état utilisateur (UX/accessibilité). | Revue d'ergonomie et tests d'accessibilité manuels. |

---

## 3 · LA PORTE (ÉTAPE 6)

- **Porte qualité configurée** : `CineSlot-TP` (duplication de la porte intégrée « Sonar way », associée aux deux projets `cineslot-backend` et `cineslot-frontend`).
- **Défaut ajouté exprès** : Ajout d'une comparaison interdite avec `NaN` dans `backend/src/server.js:23` : `if (PORT === NaN) { ... }` (règle de fiabilité `javascript:S2688`, sévérité Major / Bug).
- **Condition qui a échoué et sa valeur** : Condition sur le nouveau code `new_reliability_rating > 1` (Valeur constatée : **3 / Note C** contre seuil d'erreur **1 / Note A**).
- **Verdict 1.2 avant (avec défaut)** : **Failed (ERROR)** (analyse du 29/10/2026 à 16:58).
- **Verdict 1.2 après (défaut retiré)** : **Passed (OK)** (analyse du 29/10/2026 à 17:00, `new_reliability_rating = 1`).
- *(Bonus) Liens / exécutions locales* : Analyses exécutées via `sonarsource/sonar-scanner-cli` contre le serveur local `http://localhost:9000` (projets `cineslot-backend` et `cineslot-frontend`).
