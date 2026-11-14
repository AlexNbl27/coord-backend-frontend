param(
    [int]$MaxVus = 500,
    [int]$MaxPingMs = 500
)

Write-Host "Simulation CI locale (k6) : MAX_VUS=$MaxVus, MAX_PING=${MaxPingMs}ms" -ForegroundColor Cyan

Write-Host "`n[1/4] Demarrage de MongoDB et du Backend..." -ForegroundColor Yellow
docker compose up -d mongodb backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du demarrage des conteneurs." -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/4] Attente de la disponibilite de l'API (backend:3000/health)..." -ForegroundColor Yellow
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
    }
    Write-Host "  ... tentative $attempt/$maxAttempts" -ForegroundColor DarkGray
}

if (-not $healthy) {
    Write-Host "Le Backend n'a pas repondu a temps." -ForegroundColor Red
    docker compose logs backend
    exit 1
}

Write-Host "Backend operationnel et connecte a MongoDB." -ForegroundColor Green

if (-not $env:K6_ADMIN_EMAIL) { $env:K6_ADMIN_EMAIL = "k6-admin@cineslot.test" }
if (-not $env:K6_ADMIN_PASSWORD) { $env:K6_ADMIN_PASSWORD = -join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object { [char]$_ }) }
Write-Host "`nCreation du compte admin k6 ($env:K6_ADMIN_EMAIL)..." -ForegroundColor Yellow
docker compose exec -T backend node scripts/create-admin.js --email "$env:K6_ADMIN_EMAIL" --name "k6 Admin" --password "$env:K6_ADMIN_PASSWORD"
if ($LASTEXITCODE -ne 0) { Write-Host "Compte deja existant : K6_ADMIN_PASSWORD doit correspondre a son mot de passe." -ForegroundColor Yellow }

Write-Host "`n[3/4] Execution du test de charge k6..." -ForegroundColor Yellow
docker compose run --rm -e MAX_VUS="$MaxVus" -e MAX_PING_MS="$MaxPingMs" k6-ci
$k6ExitCode = $LASTEXITCODE

Write-Host "`n[4/4] Resume et nettoyage..." -ForegroundColor Yellow
if ($k6ExitCode -eq 0) {
    Write-Host "SUCCES : seuils de qualite respectes." -ForegroundColor Green
} else {
    Write-Host "ECHEC : seuils de performance ou d'erreur depasses." -ForegroundColor Red
}

Write-Host "`nNettoyage des résidus de tests k6 dans MongoDB..." -ForegroundColor Cyan
docker exec ynov-mongodb mongosh cours_db --quiet --eval "db.movies.deleteMany({`$or: [{director: 'k6 Tester'}, {title: /^Film k6/}]})"

Write-Host "`nNettoyage de l'environnement (arrêt des conteneurs)..." -ForegroundColor Yellow
docker compose down

exit $k6ExitCode
