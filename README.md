# 🎮 RAWG Games API

API REST pour interroger une base de données de jeux vidéo.

## 📋 Prérequis

- **Docker** + **Docker Compose** installés
- Fichier `rawg-games-cleaned.csv` (généré par le notebook)

## 🚀 Déploiement

### Windows
```batch
deploy.bat
```

### Linux / macOS
```bash
chmod +x deploy.sh
./deploy.sh
```

### Manuel
```bash
docker compose up --build -d
```

## 🌐 Endpoints API

| Route | Description |
|-------|-------------|
| `GET /health` | Vérifier l'état de l'API et de la DB |
| `GET /api/games` | Liste des jeux (paginée) |
| `GET /api/games/:id` | Détail d'un jeu par ID |
| `GET /api/games/:slug` | Détail d'un jeu par slug |
| `GET /api/stats` | Statistiques globales |

### Paramètres de pagination

```
GET /api/games?page=1&limit=20&search=zelda&genre=Action&platform=PC
```

## 📊 Exemples

```bash
# Healthcheck
curl http://localhost:3000/health

# Liste des jeux
curl http://localhost:3000/api/games

# Rechercher un jeu
curl "http://localhost:3000/api/games?search=witcher"

# Détail d'un jeu
curl http://localhost:3000/api/games/the-witcher-3-wild-hunt

# Stats
curl http://localhost:3000/api/stats
```

## 🛑 Arrêter

```bash
docker compose down
```

## 📁 Structure du projet

```
├── docker/
│   ├── init.sql          # Création des tables
│   └── import-data.sql   # Import du CSV
├── src/
│   └── index.js          # API Express
├── docker-compose.yml    # Orchestration
├── Dockerfile.api        # Image API
├── deploy.sh             # Script Linux
├── deploy.bat            # Script Windows
└── rawg-games-cleaned.csv
```
