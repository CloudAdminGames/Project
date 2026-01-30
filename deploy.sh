#!/bin/bash
# =============================================================================
# Script de déploiement - Linux/macOS
# =============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       🚀 Déploiement RAWG Games API - Linux               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Installez Docker d'abord."
    exit 1
fi

# Vérifier que le fichier CSV existe
if [ ! -f "rawg-games-cleaned.csv" ]; then
    echo "❌ Fichier rawg-games-cleaned.csv non trouvé!"
    echo "   Exécutez d'abord le notebook data_cleaning.ipynb"
    exit 1
fi

echo "📦 Arrêt des conteneurs existants..."
docker compose down -v 2>/dev/null || true

echo "🔨 Construction et démarrage des conteneurs..."
docker compose up --build -d

echo ""
echo "⏳ Attente du démarrage de PostgreSQL..."
sleep 10

# Attendre que la base soit prête
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U rawg_user -d rawg_games &>/dev/null; then
        echo "✅ PostgreSQL est prêt!"
        break
    fi
    echo "   Attente... ($i/30)"
    sleep 2
done

echo ""
echo "⏳ Attente du démarrage de l'API..."
sleep 5

# Tester le healthcheck
echo ""
echo "🔍 Test de connexion à l'API..."
for i in {1..10}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ API accessible!"
        echo ""
        echo "📊 Résultat du healthcheck:"
        curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health
        break
    fi
    echo "   Attente de l'API... ($i/10)"
    sleep 2
done

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                   ✅ DÉPLOIEMENT RÉUSSI                   ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  🌐 API:        http://localhost:3000                     ║"
echo "║  💚 Health:     http://localhost:3000/health              ║"
echo "║  🎮 Games:      http://localhost:3000/api/games           ║"
echo "║  📊 Stats:      http://localhost:3000/api/stats           ║"
echo "║                                                           ║"
echo "║  🛑 Arrêter:    docker compose down                       ║"
echo "║  📋 Logs:       docker compose logs -f                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
