# Qualite logicielle (SonarQube)

## 1. Mesures initiales (snapshot du 29/10/2026)

| Projet | Lignes | Secu. | Fiab. | Maint. | Couverture | Dupl. | Porte |
|---|---|---|---|---|---|---|---|
| back | 996 | A | A | A | 20.6 % | 0.0 % | Passed |
| front | 5667 | A | A | A | 45.3 % | 1.5 % | Passed |

## 2. Problemes analyses

| # | Probleme (fichier:ligne) | Regle | Decision et raison | Preuve |
|---|---|---|---|---|
| 1 | `backend/src/services/slotService.js:593` | `javascript:S2245` | Faux positif accepte : `Math.random()` sert uniquement a tirer un film pour les seances de demo (`createDemoSlot`). | Revu dans SonarQube |
| 2 | `backend/src/server.js:33` | `javascript:S3358` | Corrige : extraction du ternaire imbrique dans `defaultCPUs`. | Statut `CLOSED FIXED` (29/10/2026) |
| 3 | `frontend/src/composables/useAccessibleDialog.ts:1` | `typescript:S1128` | Corrige : suppression de l'import `ref` inutilise. | Statut `CLOSED FIXED` (29/10/2026) |
| 4 | `frontend/src/stores/slots.ts:46` | `typescript:S4043` | Accepte : tri in-place `.sort()` confine a la mutation de l'etat reactif Pinia. | Revu dans SonarQube |

## 3. Porte qualite

- Porte qualite : `CineSlot-TP` (copie de « Sonar way »).
- Defaut injecte pour verification : comparaison `PORT === NaN` dans `backend/src/server.js:32` (`javascript:S2688`).
- Verdict avant retrait : Failed (`new_reliability_rating = 3` / C).
- Verdict apres retrait : Passed (`new_reliability_rating = 1` / A).
