#!/usr/bin/env bash
set -e

MAX_VUS="${1:-${MAX_VUS:-500}}"
MAX_PING_MS="${2:-${MAX_PING_MS:-500}}"

echo "Simulation CI locale (k6) : MAX_VUS=$MAX_VUS, MAX_PING=${MAX_PING_MS}ms"

echo -e "\n[1/4] Demarrage de MongoDB et du Backend..."
docker compose up -d mongodb backend

echo -e "\n[2/4] Attente de la disponibilite de l'API..."
max_retries=30
count=0
until docker compose exec -T backend node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(t=>process.stdout.write(t))" 2>/dev/null | grep -q '"database":"connected"'; do
  sleep 2
  count=$((count+1))
  echo "  ... tentative $count/$max_retries"
  if [ $count -ge $max_retries ]; then
    echo "Le Backend n'a pas repondu a temps."
    docker compose logs backend
    docker compose down
    exit 1
  fi
done
echo "API operationnelle et connectee a MongoDB."

: "${K6_ADMIN_EMAIL:=k6-admin@cineslot.test}"
: "${K6_ADMIN_PASSWORD:=$(openssl rand -hex 24)}"
export K6_ADMIN_EMAIL K6_ADMIN_PASSWORD
echo -e "\nCreation du compte admin k6 ($K6_ADMIN_EMAIL)..."
docker compose exec -T backend node scripts/create-admin.js --email "$K6_ADMIN_EMAIL" --name "k6 Admin" --password "$K6_ADMIN_PASSWORD" || echo "Compte deja existant : K6_ADMIN_PASSWORD doit correspondre a son mot de passe."

echo -e "\n[3/4] Execution du test de charge k6..."
set +e
docker compose run --rm -e MAX_VUS="$MAX_VUS" -e MAX_PING_MS="$MAX_PING_MS" k6-ci
k6_exit_code=$?
set -e

echo -e "\n[4/4] Resume et nettoyage..."
if [ $k6_exit_code -eq 0 ]; then
  echo "SUCCES : seuils de qualite respectes."
else
  echo "ECHEC : seuils non respectes (code retour $k6_exit_code)."
fi

echo -e "\nNettoyage des residus de tests k6 dans MongoDB..."
if [ -n "${MONGO_ROOT_USERNAME:-}" ] && [ -n "${MONGO_ROOT_PASSWORD:-}" ]; then
  docker compose exec -T mongodb mongosh cours_db -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --quiet --eval "db.movies.deleteMany({\$or: [{director: 'k6 Tester'}, {title: /^Film k6/}]})" || true
fi

echo -e "\nNettoyage de l'environnement..."
docker compose down

exit $k6_exit_code
