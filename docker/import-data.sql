-- =============================================================================
-- Import des données CSV dans PostgreSQL
-- =============================================================================

-- Importer les données depuis le CSV
COPY games(id, slug, name, released, background_image, ratings_count, reviews_count, 
           ratings, platforms, parent_platforms, genres, tags, developers, 
           publishers, stores, description_raw, short_screenshots)
FROM '/data/rawg-games-cleaned.csv'
WITH (
    FORMAT CSV,
    HEADER true,
    DELIMITER ',',
    QUOTE '"',
    NULL ''
);

-- Mettre à jour le healthcheck
UPDATE health SET status = 'data_loaded', last_check = CURRENT_TIMESTAMP;

-- Afficher le nombre de jeux importés
DO $$
DECLARE
    game_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO game_count FROM games;
    RAISE NOTICE '✅ % jeux importés avec succès!', game_count;
END $$;
