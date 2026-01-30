@echo off
REM =============================================================================
REM Script de déploiement - Windows
REM =============================================================================

echo ╔═══════════════════════════════════════════════════════════╗
echo ║       🚀 Déploiement RAWG Games API - Windows             ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM Vérifier que Docker est installé
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker n'est pas installé. Installez Docker Desktop d'abord.
    pause
    exit /b 1
)

REM Vérifier que le fichier CSV existe
if not exist "rawg-games-cleaned.csv" (
    echo ❌ Fichier rawg-games-cleaned.csv non trouvé!
    echo    Exécutez d'abord le notebook data_cleaning.ipynb
    pause
    exit /b 1
)

echo 📦 Arrêt des conteneurs existants...
docker compose down -v 2>nul

echo 🔨 Construction et démarrage des conteneurs...
docker compose up --build -d

echo.
echo ⏳ Attente du démarrage de PostgreSQL (30 secondes)...
timeout /t 30 /nobreak >nul

echo.
echo ⏳ Attente du démarrage de l'API (10 secondes)...
timeout /t 10 /nobreak >nul

echo.
echo 🔍 Test de connexion à l'API...
curl -s http://localhost:3000/health
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  curl non trouvé, utilisez un navigateur pour tester:
    echo    http://localhost:3000/health
)

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                   ✅ DÉPLOIEMENT RÉUSSI                   ║
echo ╠═══════════════════════════════════════════════════════════╣
echo ║  🌐 API:        http://localhost:3000                     ║
echo ║  💚 Health:     http://localhost:3000/health              ║
echo ║  🎮 Games:      http://localhost:3000/api/games           ║
echo ║  📊 Stats:      http://localhost:3000/api/stats           ║
echo ║                                                           ║
echo ║  🛑 Arrêter:    docker compose down                       ║
echo ║  📋 Logs:       docker compose logs -f                    ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
pause
