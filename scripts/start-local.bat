@echo off
chcp 65001 > nul

echo ============================================
echo Demarrage de l'environnement local Cineslot
echo ============================================
echo.

:: Demarrer MongoDB (si disponible localement)
echo [1/3] Demarrage de MongoDB...
start "MongoDB" mongod --dbpath "%~dp0..\database\data" --port 27017

:: Attendre que MongoDB soit pret
timeout /t 5 /nobreak > nul

:: Demarrer le backend Node.js
echo [2/3] Demarrage du backend Node.js (port 3000)...
start "Backend" cmd /k "cd /d %~dp0..\backend && npm start"

:: Attendre que le backend soit pret
timeout /t 5 /nobreak > nul

:: Servir le frontend
echo [3/3] Demarrage du frontend (port 3001)...
echo.
echo ============================================
echo Frontend disponible sur: http://localhost:3001
echo Backend API (Films, Séances & SSE): http://localhost:3000/api
echo ============================================
echo.
echo Pour arreter tous les services, fermez les fenetres de commande.
echo.

:: Servir les fichiers statiques
echo Demarrage du serveur de fichiers statiques...
cd /d %~dp0..\frontend
npx serve -s dist -l 3001
