-- =============================================================================
-- Script d'initialisation PostgreSQL - RAWG Games Database
-- =============================================================================

-- Créer la table principale des jeux
CREATE TABLE IF NOT EXISTS games (
    id              BIGINT PRIMARY KEY,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(500) NOT NULL,
    released        VARCHAR(50),  -- Date en texte pour flexibilité
    background_image TEXT,
    ratings_count   INTEGER DEFAULT 0,
    reviews_count   INTEGER DEFAULT 0,
    ratings         JSONB,  -- Détail des votes par catégorie
    platforms       JSONB,  -- ["PC", "PlayStation 5", ...]
    parent_platforms JSONB,
    genres          JSONB,  -- ["Action", "RPG", ...]
    tags            JSONB,
    developers      JSONB,  -- ["Rockstar Games", ...]
    publishers      JSONB,
    stores          JSONB,  -- ["Steam", "Epic Games", ...]
    description_raw TEXT,
    short_screenshots JSONB,  -- URLs des screenshots
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances des requêtes courantes
CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
CREATE INDEX IF NOT EXISTS idx_games_released ON games(released);
CREATE INDEX IF NOT EXISTS idx_games_ratings_count ON games(ratings_count DESC);

-- Index GIN pour recherches JSONB efficaces
CREATE INDEX IF NOT EXISTS idx_games_platforms ON games USING GIN(platforms);
CREATE INDEX IF NOT EXISTS idx_games_genres ON games USING GIN(genres);
CREATE INDEX IF NOT EXISTS idx_games_developers ON games USING GIN(developers);

-- Créer une table pour le healthcheck
CREATE TABLE IF NOT EXISTS health (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'healthy',
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO health (status) VALUES ('initialized');

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Base de données initialisée avec succès!';
END $$;
