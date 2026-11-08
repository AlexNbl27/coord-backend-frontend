param(
    [int]$MaxVus = 500,
    [int]$MaxPingMs = 500
)

# ==============================================================================
# Script d'émulation locale de la CI GitHub Actions (PowerShell)
# Exécute la même séquence que le workflow .github/workflows/load-test.yml
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   🚀 DÉMARRAGE DE LA SIMULATION CI LOCALE (k6 LOAD TEST)  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "⚙️ Configuration : MAX_VUS = $MaxVus (Paliers: 10%, 30%, 60%, 100%) | MAX_PING = ${MaxPingMs}ms" -ForegroundColor DarkCyan

# 1. Démarrage des conteneurs backend et mongodb
Write-Host "`n[1/4] Démarrage de MongoDB et du Backend..." -ForegroundColor Yellow
docker compose up -d mongodb backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du démarrage des conteneurs." -ForegroundColor Red
    exit 1
}

# 2. Attente de la disponibilité de l'API
Write-Host "`n[2/4] Attente de la disponibilité de l'API (backend:3000/health depuis le conteneur)..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$healthy = $false

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempt++
    try {
        $raw = docker compose exec -T backend node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(t=>process.stdout.write(t))" 2>$null
        $response = $raw | ConvertFrom-Json
        if ($response.status -eq "OK" -and $response.database -eq "connected") {
            $healthy = $true
            break
        }
    } catch {
        # En attente que le serveur réponde
    }
    Write-Host "  ... tentative $attempt/$maxAttempts" -ForegroundColor DarkGray
}

if (-not $healthy) {
    Write-Host "❌ Le Backend n'a pas répondu à temps." -ForegroundColor Red
    docker compose logs backend
    exit 1
}

Write-Host "✅ Backend opérationnel et connecté à MongoDB !" -ForegroundColor Green

if (-not $env:K6_ADMIN_EMAIL) { $env:K6_ADMIN_EMAIL = "k6-admin@cineslot.test" }
if (-not $env:K6_ADMIN_PASSWORD) { $env:K6_ADMIN_PASSWORD = -join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object { [char]$_ }) }
Write-Host "`nCréation du compte admin k6 ($env:K6_ADMIN_EMAIL)..." -ForegroundColor Yellow
docker compose exec -T backend node scripts/create-admin.js --email "$env:K6_ADMIN_EMAIL" --name "k6 Admin" --password "$env:K6_ADMIN_PASSWORD"
if ($LASTEXITCODE -ne 0) { Write-Host "⚠️ Compte déjà existant : K6_ADMIN_PASSWORD doit correspondre à son mot de passe." -ForegroundColor Yellow }

# 3. Exécution du test de charge k6
Write-Host "`n[3/4] Exécution du test de montée en charge k6 (mode CI)..." -ForegroundColor Yellow
docker compose run --rm -e MAX_VUS="$MaxVus" -e MAX_PING_MS="$MaxPingMs" k6-ci
$k6ExitCode = $LASTEXITCODE

# 4. Résumé et nettoyage
Write-Host "`n[4/4] Résumé de l'exécution et nettoyage..." -ForegroundColor Yellow
if ($k6ExitCode -eq 0) {
    Write-Host "🎉 SUCCÈS : Tous les seuils de qualité (thresholds) ont été respectés !" -ForegroundColor Green
} else {
    Write-Host "❌ ÉCHEC : Les seuils de performance ou de taux d'erreur ont été dépassés." -ForegroundColor Red
}

Write-Host "`nNettoyage des résidus de tests k6 dans MongoDB..." -ForegroundColor Cyan
docker exec ynov-mongodb mongosh cours_db --quiet --eval "db.movies.deleteMany({`$or: [{director: 'k6 Tester'}, {title: /^Film k6/}]})"

Write-Host "`nNettoyage de l'environnement (arrêt des conteneurs)..." -ForegroundColor Yellow
docker compose down

exit $k6ExitCode
