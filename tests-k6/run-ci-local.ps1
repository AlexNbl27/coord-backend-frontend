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
Write-Host "`n[2/4] Attente de la disponibilité de l'API sur http://localhost:3000/health..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$healthy = $false

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempt++
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
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

# 3. Exécution du test de charge k6
Write-Host "`n[3/4] Exécution du test de montée en charge k6 (mode CI)..." -ForegroundColor Yellow
docker compose run --rm -e MAX_VUS="$MaxVus" -e MAX_PING_MS="$MaxPingMs" k6-ci
$k6ExitCode = $LASTEXITCODE

# 4. Résumé et nettoyage
Write-Host "`n[4/4] Résumé de l'exécution..." -ForegroundColor Yellow
if ($k6ExitCode -eq 0) {
    Write-Host "🎉 SUCCÈS : Tous les seuils de qualité (thresholds) ont été respectés !" -ForegroundColor Green
} else {
    Write-Host "❌ ÉCHEC : Les seuils de performance ou de taux d'erreur ont été dépassés." -ForegroundColor Red
}

Write-Host "`nNettoyage de l'environnement (arrêt des conteneurs)..." -ForegroundColor Yellow
docker compose down

exit $k6ExitCode
