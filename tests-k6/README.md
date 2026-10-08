# 🚀 Tests de charge et de performance avec Grafana k6

Ce dossier contient les scénarios de test de charge conçus pour évaluer la résilience et les performances de l'API Node.js/Express connectée à MongoDB.

---

## 📈 Scénario de montée en charge (`load-test.js`)

Le test simule une montée progressive par paliers (**Ramping VUs**) :
1. **0s ➜ 15s** : Montée douce de 0 à **10 VUs** (*Warmup*).
2. **15s ➜ 35s** : Charge de croisière à **25 VUs**.
3. **35s ➜ 55s** : Pic de charge (*Stress test*) à **50 VUs**.
4. **55s ➜ 70s** : Récupération et descente à **0 VU**.

### Mix de trafic simulé :
- `20%` : `GET /health` (requêtes de santé légères).
- `40%` : `GET /api/movies` (consultation de la liste des films).
- `30%` : `GET /api/movies?genre=...&minRating=...` (requêtes filtrées avec index Mongoose).
- `10%` : `POST /api/movies` (écritures concurrentes dans MongoDB).

### Seuils de qualité (*Thresholds*) :
- Taux d'échec global : `< 2%`
- Temps de réponse p95 : `< 400ms`
- Temps de réponse p99 : `< 800ms`
- Temps de création de film p90 : `< 500ms`

---

## 1. Mode Interactif : Web Dashboard en direct

Idéal pour observer les graphiques en temps réel pendant une présentation ou un cours :

```bash
docker compose run --rm -p 5665:5665 k6
```

👉 Ouvrez votre navigateur sur **[http://localhost:5665](http://localhost:5665)**
- Grâce à l'option `--linger`, le dashboard reste accessible même après la fin du test pour vous permettre d'analyser les métriques.
- Pour quitter : faites `Ctrl + C` dans le terminal.

---

## 2. Mode CI Automatisé (Local ou GitHub Actions)

Ce mode exécute le test de manière non-bloquante et valide automatiquement les seuils avec un code retour (`0` en cas de succès, `1` en cas d'échec).

### A. Exécution locale (Simulation CI)

- **Sur Windows (PowerShell)** :
  ```powershell
  ./tests-k6/run-ci-local.ps1
  ```
- **Sur Linux / macOS / Git Bash** :
  ```bash
  chmod +x ./tests-k6/run-ci-local.sh
  ./tests-k6/run-ci-local.sh
  ```
- **Ou directement via Docker Compose** :
  ```bash
  docker compose run --rm k6-ci
  ```

### B. Exécution avec l'outil `act` (Runner GitHub Actions local)
Si vous avez installé [act](https://github.com/nektos/act) sur votre machine :
```bash
act -W .github/workflows/load-test.yml
```

### C. Pipeline GitHub Actions distant
Le fichier [`.github/workflows/load-test.yml`](../.github/workflows/load-test.yml) se déclenche automatiquement lors des push / pull requests ou manuellement via le bouton **"Run workflow"** sur GitHub Actions.
