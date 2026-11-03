#!/usr/bin/env bash
# ==============================================================================
# Script d'émulation locale de la CI GitHub Actions (Bash)
# Exécute la même séquence que le workflow .github/workflows/load-test.yml
# ==============================================================================

set -e

MAX_VUS="${1:-${MAX_VUS:-500}}"
MAX_PING_MS="${2:-${MAX_PING_MS:-500}}"

echo "=========================================================="
echo "   🚀 DÉMARRAGE DE LA SIMULATION CI LOCALE (k6 LOAD TEST)  "
echo "=========================================================="
echo "⚙️ Configuration : MAX_VUS = $MAX_VUS (Paliers: 10%, 30%, 60%, 100%) | MAX_PING = ${MAX_PING_MS}ms"

echo -e "\n[1/4] Démarrage de MongoDB et du Backend..."
docker compose up -d mongodb backend

echo -e "\n[2/4] Attente de la disponibilité de l'API..."
max_retries=30
count=0
until docker compose exec -T backend node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(t=>process.stdout.write(t))" 2>/dev/null | grep -q '"database":"connected"'; do
  sleep 2
  count=$((count+1))
  echo "  ... tentative $count/$max_retries"
  if [ $count -ge $max_retries ]; then
    echo "❌ Le Backend n'a pas répondu à temps !"
    docker compose logs backend
    docker compose down
    exit 1
  fi
done
echo "✅ API opérationnelle et connectée à MongoDB !"

echo -e "\n[3/4] Exécution du test de montée en charge k6 (mode CI)..."
set +e
docker compose run --rm -e MAX_VUS="$MAX_VUS" -e MAX_PING_MS="$MAX_PING_MS" k6-ci
k6_exit_code=$?
set -e

echo -e "\n[4/4] Résumé de l'exécution et nettoyage..."
if [ $k6_exit_code -eq 0 ]; then
  echo "🎉 SUCCÈS : Tous les seuils de qualité ont été respectés !"
else
  echo "❌ ÉCHEC : Seuils non respectés (code retour $k6_exit_code)."
fi

echo -e "\nNettoyage des résidus de tests k6 dans MongoDB..."
docker exec ynov-mongodb mongosh cours_db --quiet --eval "db.movies.deleteMany({\$or: [{director: 'k6 Tester'}, {title: /^Film k6/}]})" || true

echo -e "\nNettoyage de l'environnement..."
docker compose down

exit $k6_exit_code
