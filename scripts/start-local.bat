@echo off
chcp 65001 > nul

echo ============================================
echo Demarrage de l'environnement local Cineslot
echo ============================================
echo.

:: Demarrer MongoDB (si disponible localement)
echo [1/4] Demarrage de MongoDB...
start "MongoDB" mongod --dbpath "%~dp0..\database\data" --port 27017

:: Attendre que MongoDB soit pret
timeout /t 5 /nobreak > nul

:: Demarrer le backend Node.js
echo [2/4] Demarrage du backend Node.js (port 3000)...
start "Backend" cmd /k "cd /d %~dp0..\backend && npm start"

:: Attendre que le backend soit pret
timeout /t 5 /nobreak > nul

:: Demarrer le service SSE Spring Boot
echo [3/4] Demarrage du service SSE Spring Boot (port 8086)...
start "SSE Service" cmd /k "cd /d %~dp0..\services\cineslot-sse && mvn spring-boot:run"

:: Attendre que le service SSE soit pret
timeout /t 10 /nobreak > nul

:: Servir le frontend
echo [4/4] Demarrage du frontend (port 3001)...
echo.
echo ============================================
echo Frontend disponible sur: http://localhost:3001
echo Backend API: http://localhost:3000/api/movies
echo SSE Service: http://localhost:8086/api/slots
echo ============================================
echo.
echo Pour arreter tous les services, fermez les fenetres de commande.
echo.

:: Servir les fichiers statiques
echo Demarrage du serveur de fichiers statiques...
cd /d %~dp0..\frontend
npx serve -s dist -l 3001
