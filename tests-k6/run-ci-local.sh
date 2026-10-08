#!/usr/bin/env bash
# ==============================================================================
# Script d'émulation locale de la CI GitHub Actions (Bash)
# Exécute la même séquence que le workflow .github/workflows/load-test.yml
# ==============================================================================

set -e

echo "=========================================================="
echo "   🚀 DÉMARRAGE DE LA SIMULATION CI LOCALE (k6 LOAD TEST)  "
echo "=========================================================="

echo -e "\n[1/4] Démarrage de MongoDB et du Backend..."
docker compose up -d mongodb backend

echo -e "\n[2/4] Attente de la disponibilité de l'API..."
max_retries=30
count=0
until curl -s http://localhost:3000/health | grep -q '"database":"connected"'; do
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
docker compose run --rm k6-ci
k6_exit_code=$?
set -e

echo -e "\n[4/4] Résumé de l'exécution..."
if [ $k6_exit_code -eq 0 ]; then
  echo "🎉 SUCCÈS : Tous les seuils de qualité ont été respectés !"
else
  echo "❌ ÉCHEC : Seuils non respectés (code retour $k6_exit_code)."
fi

echo -e "\nNettoyage de l'environnement..."
docker compose down

exit $k6_exit_code
