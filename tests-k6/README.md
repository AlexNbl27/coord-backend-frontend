# Tests de charge et de performance avec Grafana k6

Ce dossier contient les scénarios de test de charge conçus pour évaluer la résilience et les performances de l'API Node.js/Express connectée à MongoDB.

---

## Scénario de montée en charge (`load-test.js`)

Le test simule une montée progressive par paliers calculés dynamiquement en **pourcentages de la charge maximale (`MAX_VUS`)** :
1. **0s 15s** : Montée à **10% du MAX** (*Warmup*).
2. **15s 30s** : Montée à **30% du MAX** (*Charge nominale*).
3. **30s 50s** : Montée à **60% du MAX** (*Zone limite / Forte affluence*).
4. **50s 70s** : Pic à **100% du MAX** (*Point de rupture ciblé*).
5. **70s 80s** : Descente et récupération à **0 VU**.

### Paramètres configurables (Variables d'environnement) :
- `MAX_VUS` : Capacité maximale ciblée (par défaut : `500` VUs).
- `MAX_PING_MS` : Marge de latence/ping tolérée au 95e centile (par défaut : `500` ms).
- `TARGET_URL` : URL de l'API ciblée (par défaut : `http://backend:3000`).

### Mix de trafic simulé :
- `25%` : `GET /health` (requêtes de santé légères).
- `40%` : `GET /api/movies` (consultation de la liste des films).
- `25%` : `GET /api/movies?genre=...&minRating=...` (requêtes filtrées avec index Mongoose).
- `10%` : `POST /api/movies` (écritures concurrentes dans MongoDB).

### Seuils de qualité (*Thresholds*) :
- Temps de réponse p95 : `< MAX_PING_MS` (par défaut `< 500ms`)
- Temps de réponse p99 : `< 1200ms`
- Taux d'échec HTTP global : `< 1%`
- Taux d'échec des vérifications fonctionnelles : `< 1%`

---

## 1. Mode Interactif : Web Dashboard en direct

Idéal pour observer les graphiques en temps réel pendant une présentation ou un cours :

```bash
docker compose run --rm -p 5665:5665 k6
```

Ouvrez votre navigateur sur **[http://localhost:5665](http://localhost:5665)**
- Grâce à l'option `--linger`, le dashboard reste accessible même après la fin du test pour vous permettre d'analyser les métriques.
- Pour quitter : faites `Ctrl + C` dans le terminal.

---

## 2. Mode CI Automatisé (Local ou GitHub Actions)

Ce mode exécute le test de manière non-bloquante et valide automatiquement les seuils avec un code retour (`0` en cas de succès, `1` en cas d'échec).

### A. Exécution locale (Simulation CI)

Vous pouvez exécuter le script avec les valeurs par défaut (500 VUs, ping 500ms) ou spécifier vos propres valeurs :

- **Sur Windows (PowerShell)** :
  ```powershell
  # Valeurs par défaut (500 VUs, 500ms ping toléré) :
  ./tests-k6/run-ci-local.ps1

  # Avec valeurs personnalisées :
  ./tests-k6/run-ci-local.ps1 -MaxVus 200 -MaxPingMs 400
  ```
- **Sur Linux / macOS / Git Bash** :
  ```bash
  chmod +x ./tests-k6/run-ci-local.sh
  # Valeurs par défaut :
  ./tests-k6/run-ci-local.sh

  # Avec valeurs personnalisées :
  ./tests-k6/run-ci-local.sh 200 400
  ```
- **Ou directement via Docker Compose** :
  ```bash
  docker compose run --rm -e MAX_VUS=200 -e MAX_PING_MS=400 k6-ci
  ```

### B. Pipeline GitHub Actions & Création d'Issue automatique
Le workflow [`.github/workflows/load-test.yml`](../.github/workflows/load-test.yml) se déclenche :
- Automatiquement lors des `push` et `pull_request` sur les branches `main`, `master` et `develop`.
- Manuellement via le bouton **"Run workflow"** avec choix des valeurs `max_vus` et `max_ping_ms`.

**Notification incident** : Si l'API dépasse la marge de ping tolérée ou subit plus de 1% d'erreurs, le job CI échoue et **ouvre automatiquement un ticket GitHub (Issue)** avec tous les détails du run (commit, branche, métriques ciblées, diagnostic recommandé).
