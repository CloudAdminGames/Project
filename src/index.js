const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Configuration
const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Connexion PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'rawg_user',
  password: process.env.DB_PASSWORD || 'rawg_password',
  database: process.env.DB_NAME || 'rawg_games',
});

// =============================================================================
// ROUTES
// =============================================================================

// Health check - Vérifier que l'API et la DB fonctionnent
app.get('/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT status, last_check FROM health ORDER BY id DESC LIMIT 1');
    const gamesCount = await pool.query('SELECT COUNT(*) as count FROM games');
    
    res.json({
      status: 'healthy',
      api: 'running',
      database: {
        connected: true,
        status: dbResult.rows[0]?.status || 'unknown',
        lastCheck: dbResult.rows[0]?.last_check,
        gamesCount: parseInt(gamesCount.rows[0].count)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      api: 'running',
      database: { connected: false, error: error.message },
      timestamp: new Date().toISOString()
    });
  }
});

// Liste des jeux avec pagination
app.get('/api/games', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const genre = req.query.genre || '';
    const platform = req.query.platform || '';
    const developer = req.query.developer || '';

    let query = `
      SELECT id, slug, name, released, background_image, ratings_count, 
             genres, platforms, developers
      FROM games 
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    // Recherche JSONB précise avec l'opérateur ? (contains key)
    if (genre) {
      query += ` AND genres ? $${paramIndex}`;
      params.push(genre);
      paramIndex++;
    }
    if (platform) {
      query += ` AND platforms ? $${paramIndex}`;
      params.push(platform);
      paramIndex++;
    }
    if (developer) {
      query += ` AND developers ? $${paramIndex}`;
      params.push(developer);
      paramIndex++;
    }

    query += ` ORDER BY ratings_count DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    // Compter le total
    let countQuery = 'SELECT COUNT(*) FROM games WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;
    
    if (search) {
      countQuery += ` AND name ILIKE $${countParamIndex}`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    if (genre) {
      countQuery += ` AND genres ? $${countParamIndex}`;
      countParams.push(genre);
      countParamIndex++;
    }
    if (platform) {
      countQuery += ` AND platforms ? $${countParamIndex}`;
      countParams.push(platform);
      countParamIndex++;
    }
    if (developer) {
      countQuery += ` AND developers ? $${countParamIndex}`;
      countParams.push(developer);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Détail d'un jeu par ID ou slug
app.get('/api/games/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const isNumeric = /^\d+$/.test(identifier);
    
    const query = isNumeric 
      ? 'SELECT * FROM games WHERE id = $1'
      : 'SELECT * FROM games WHERE slug = $1';
    
    const result = await pool.query(query, [identifier]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stats globales
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_games,
        AVG(ratings_count)::INTEGER as avg_ratings,
        MAX(ratings_count) as max_ratings
      FROM games
    `);
    
    res.json(stats.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Liste des genres uniques avec comptage
app.get('/api/genres', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT genre, COUNT(*) as games_count
      FROM games, jsonb_array_elements_text(genres) AS genre
      GROUP BY genre
      ORDER BY games_count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Liste des plateformes uniques avec comptage
app.get('/api/platforms', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT platform, COUNT(*) as games_count
      FROM games, jsonb_array_elements_text(platforms) AS platform
      GROUP BY platform
      ORDER BY games_count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Liste des développeurs uniques (top 100)
app.get('/api/developers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT developer, COUNT(*) as games_count
      FROM games, jsonb_array_elements_text(developers) AS developer
      GROUP BY developer
      ORDER BY games_count DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// Démarrage du serveur
// =============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           🎮 RAWG Games API - Running                     ║
╠═══════════════════════════════════════════════════════════╣
║  API URL:     http://localhost:${PORT}                       ║
║  Health:      http://localhost:${PORT}/health                ║
║  Games:       http://localhost:${PORT}/api/games             ║
║  Stats:       http://localhost:${PORT}/api/stats             ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
