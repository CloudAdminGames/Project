import { SQL } from "bun";

function envPositiveInt(name: string, defaultValue: number) {
  const raw = Bun.env[name];
  if (!raw) return defaultValue;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;

  return parsed;
}

const PORT = envPositiveInt("PORT", 3000);
const DATABASE_URL =
  Bun.env.DATABASE_URL ?? "postgres://admin:password123@localhost:5432/inventory";
const DB_POOL_MAX_CONNECTIONS = envPositiveInt("DB_POOL_MAX_CONNECTIONS", 50);
const BENCH_HEADER = "x-bench";
const BENCH_HEADER_VALUE = "1";
const ENABLE_HMR = Bun.env.ENABLE_HMR === "1";

function shouldLogRequest(req: Request) {
  return (
    Bun.env.BENCH_MODE !== "1" &&
    req.headers.get(BENCH_HEADER) !== BENCH_HEADER_VALUE
  );
}

const sql = new SQL(DATABASE_URL, { max: DB_POOL_MAX_CONNECTIONS });

// All valid column names in the games table
const VALID_COLUMNS = [
  "id",
  "slug",
  "name",
  "released",
  "background_image",
  "ratings_count",
  "reviews_count",
  "ratings",
  "platforms",
  "parent_platforms",
  "genres",
  "tags",
  "developers",
  "publishers",
  "stores",
  "description_raw",
  "short_screenshots",
] as const;

Bun.serve({
  port: PORT,
  routes: {
    "/health": {
      GET: (req) => {
        const start = performance.now();
        const response = new Response("OK", { status: 200 });
        const duration = performance.now() - start;
        if (shouldLogRequest(req)) {
          console.log(`GET /health - ${duration.toFixed(2)}ms`);
        }
        return response;
      },
    },
    "/api/games/search": {
      GET: async (req) => {
        const start = performance.now();
        const url = new URL(req.url);
        const column = url.searchParams.get("column");
        const searchQuery = url.searchParams.get("q");
        const trimmedQuery = searchQuery?.trim() ?? "";

        if (!trimmedQuery) {
          return Response.json(
            { error: "Missing search query parameter 'q'" },
            { status: 400 },
          );
        }

        // If a column is specified, search only that column
        if (column) {
          if (!VALID_COLUMNS.includes(column as any)) {
            return Response.json(
              {
                error: `Invalid column "${column}"`,
                valid_columns: VALID_COLUMNS,
              },
              { status: 400 },
            );
          }

          const queryText = `SELECT row_to_json(g) AS doc FROM game g WHERE "${column}"::text ILIKE $1`;
          const rows = await sql.unsafe(queryText, [`%${trimmedQuery}%`]);
          const games = rows.map((row: any) => row.doc);
          const duration = performance.now() - start;
          if (shouldLogRequest(req)) {
            console.log(
              `GET /api/games/search?column=${column}&q=${trimmedQuery} - ${duration.toFixed(2)}ms`,
            );
          }
          return Response.json({
            data: games,
            meta: {
              count: games.length,
              duration_ms: parseFloat(duration.toFixed(2)),
              column,
              query: trimmedQuery,
            },
          });
        }

        // No column specified: search across all columns (original behavior)
        const searchTerms = trimmedQuery.split(/\s+/);

        const conditions = searchTerms.map((_, index) => {
          return `g::text ILIKE $${index + 1}`;
        });

        const whereClause = conditions.join(" AND ");
        const queryText = `SELECT row_to_json(g) AS doc FROM game g WHERE ${whereClause}`;

        const searchPatterns = searchTerms.map((term) => `%${term}%`);
        const rows = await sql.unsafe(queryText, searchPatterns);
        const games = rows.map((row: any) => row.doc);
        const duration = performance.now() - start;
        if (shouldLogRequest(req)) {
          console.log(
            `GET /api/games/search?q=${trimmedQuery} - ${duration.toFixed(2)}ms`,
          );
        }
        return Response.json({
          data: games,
          meta: {
            count: games.length,
            duration_ms: parseFloat(duration.toFixed(2)),
            query: trimmedQuery,
          },
        });
      },
    },
  },
  development: {
    hmr: ENABLE_HMR,
  },
});

console.log(
  `Server is running on port ${PORT} (pool_max_connections=${DB_POOL_MAX_CONNECTIONS})`,
);
