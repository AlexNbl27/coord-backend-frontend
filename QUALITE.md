# Qualite logicielle (SonarQube)

## 1. Mesures initiales

| Projet | Lignes | Secu. | Fiab. | Maint. | Couverture | Dupl. | Porte |
|---|---|---|---|---|---|---|---|
| back | 996 | A | A | A | 20.6 % | 0.0 % | Passed |
| front | 5667 | A | A | A | 45.3 % | 1.5 % | Passed |

## 2. Problemes analyses

| # | Probleme (fichier:ligne) | Regle | Decision et raison | Preuve |
|---|---|---|---|---|
| 1 | `backend/src/services/slotService.js:224` | `javascript:S2245` | Faux positif accepte : `Math.random()` sert uniquement a tirer un film pour les seances de demo (`createDemoSlot`). | Revu dans SonarQube |
| 2 | `backend/src/server.js:19` | `javascript:S3358` | Corrige : extraction du ternaire imbrique dans `defaultCPUs`. | Commit `694141c` (`CLOSED FIXED`, 29/10/2026) |
| 3 | `frontend/src/composables/useAccessibleDialog.ts:1` | `typescript:S1128` | Corrige : suppression de l'import `ref` inutilise. | Commit `4b6c0bd` (`CLOSED FIXED`, 29/10/2026) |
| 4 | `frontend/src/stores/slots.ts:46` | `typescript:S4043` | Accepte : tri in-place `.sort()` confine a la mutation de l'etat reactif Pinia. | Revu dans SonarQube |
| + | `frontend/src/components/SseStatus.vue` | aucune | Revue manuelle : gestion du retour visuel en cas de perte SSE. | Tests d'accessibilite |

## 3. Porte qualite

- **Porte qualité configurée** : `CineSlot-TP` (duplication de la porte intégrée « Sonar way », associée aux deux projets `cineslot-backend` et `cineslot-frontend`).
- **Défaut ajouté exprès** : Ajout d'une comparaison interdite avec `NaN` dans `backend/src/server.js:23` : `if (PORT === NaN) { ... }` (règle de fiabilité `javascript:S2688`, sévérité Major / Bug).
- **Condition qui a échoué et sa valeur** : Condition sur le nouveau code `new_reliability_rating > 1` (Valeur constatée : **3 / Note C** contre seuil d'erreur **1 / Note A**).
- **Verdict 1.2 avant (avec défaut)** : **Failed (ERROR)** (analyse du 29/10/2026 à 16:58).
- **Verdict 1.2 après (défaut retiré)** : **Passed (OK)** (analyse du 29/10/2026 à 17:00, `new_reliability_rating = 1`).
- *(Bonus) Liens / exécutions locales* : Analyses exécutées via `sonarsource/sonar-scanner-cli` contre le serveur local `http://localhost:9000` (projets `cineslot-backend` et `cineslot-frontend`).
