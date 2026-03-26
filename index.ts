import { SQL } from "bun";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://admin:password123@localhost:5432/inventory";
const POOL_MAX = Number.parseInt(process.env.POOL_MAX ?? "250", 10);
const PORT = Number.parseInt(process.env.PORT ?? "3002", 10);

const sql = new SQL(DATABASE_URL, { max: POOL_MAX });

const VALID_COLUMNS = new Set(["id", "slug", "name", "released"]);
const JSON_HEADERS = { "Content-Type": "application/json" };
type SearchParams = {
  q: string | null;
  column: string | null;
  exact: boolean;
  limit: number;
  offset: number;
  releasedFrom: string | null;
  releasedTo: string | null;
  genre: string | null;
  developer: string | null;
  publisher: string | null;
  platform: string | null;
};

type BindValue = string | number;

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseParams(requestUrl: string): SearchParams {
  const url = new URL(requestUrl);
  const rawLimit = clean(url.searchParams.get("limit"));
  const rawOffset = clean(url.searchParams.get("offset"));
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 20;
  const offset = rawOffset ? Number.parseInt(rawOffset, 10) : 0;

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Limit must be between 1 and 100");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("Offset must be greater than or equal to 0");
  }

  return {
    q: clean(url.searchParams.get("q")),
    column: clean(url.searchParams.get("column")),
    exact: url.searchParams.get("exact") === "true",
    limit,
    offset,
    releasedFrom: clean(url.searchParams.get("released_from")),
    releasedTo: clean(url.searchParams.get("released_to")),
    genre: clean(url.searchParams.get("genre")),
    developer: clean(url.searchParams.get("developer")),
    publisher: clean(url.searchParams.get("publisher")),
    platform: clean(url.searchParams.get("platform")),
  };
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

function queryMeta(params: SearchParams): Record<string, string | boolean | number | null> {
  return {
    q: params.q,
    column: params.column,
    exact: params.exact,
    limit: params.limit,
    offset: params.offset,
    released_from: params.releasedFrom,
    released_to: params.releasedTo,
    genre: params.genre,
    developer: params.developer,
    publisher: params.publisher,
    platform: params.platform,
  };
}

function buildSearchSql(params: SearchParams): { sqlText: string; values: BindValue[] } {
  const values: BindValue[] = [];
  const predicates: string[] = [];

  if (params.column) {
    if (!VALID_COLUMNS.has(params.column)) {
      throw new Error(`Invalid column ${JSON.stringify(params.column)}`);
    }
    if (!params.q) {
      throw new Error("Missing search query parameter 'q'");
    }

    if (params.column === "id") {
      if (!params.exact) {
        throw new Error("Column 'id' only supports exact lookups");
      }
      const id = Number.parseInt(params.q, 10);
      if (!Number.isInteger(id)) {
        throw new Error("Invalid integer value for column 'id'");
      }
      predicates.push(`g.id = $${values.length + 1}`);
      values.push(id);
    } else if (params.column === "released") {
      if (!params.exact) {
        throw new Error("Column 'released' only supports exact lookups; use released_from/released_to for ranges");
      }
      predicates.push(`g.released = $${values.length + 1}::date`);
      values.push(params.q);
    } else {
      const operator = params.exact ? "=" : "ILIKE";
      const value = params.exact ? params.q : `%${params.q}%`;
      predicates.push(`g.${params.column} ${operator} $${values.length + 1}`);
      values.push(value);
    }
  } else if (params.q) {
    predicates.push(`g.search_tsv @@ websearch_to_tsquery('simple', $${values.length + 1})`);
    values.push(params.q);
  }

  if (params.releasedFrom) {
    predicates.push(`g.released >= $${values.length + 1}::date`);
    values.push(params.releasedFrom);
  }
  if (params.releasedTo) {
    predicates.push(`g.released <= $${values.length + 1}::date`);
    values.push(params.releasedTo);
  }
  if (params.genre) {
    predicates.push(`g.genres ? $${values.length + 1}`);
    values.push(params.genre);
  }
  if (params.developer) {
    predicates.push(`g.developers ? $${values.length + 1}`);
    values.push(params.developer);
  }
  if (params.publisher) {
    predicates.push(`g.publishers ? $${values.length + 1}`);
    values.push(params.publisher);
  }
  if (params.platform) {
    predicates.push(`g.platforms ? $${values.length + 1}`);
    values.push(params.platform);
  }

  if (predicates.length === 0) {
    throw new Error("At least one predicate is required");
  }

  const limitPlaceholder = `$${values.length + 1}`;
  values.push(params.limit);
  const offsetPlaceholder = `$${values.length + 1}`;
  values.push(params.offset);

  const sqlText = `
    WITH filtered AS (
      SELECT g.id
      FROM game g
      WHERE ${predicates.join(" AND ")}
    ), paged AS (
      SELECT f.id
      FROM filtered f
      ORDER BY f.id ASC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    )
    SELECT COALESCE((SELECT json_agg(p.id)::text FROM paged p), '[]') AS data,
           (SELECT COUNT(*)::bigint FROM filtered) AS total
  `;

  return { sqlText, values };
}

Bun.serve({
  port: PORT,
  routes: {
    "/health": { GET: () => new Response("OK") },
    "/api/games/search": {
      GET: async (req) => {
        const start = performance.now();
        let params;
        try {
          params = parseParams(req.url);
        } catch (error) {
          return jsonError(400, error instanceof Error ? error.message : "Invalid request");
        }

        let query;
        try {
          query = buildSearchSql(params);
        } catch (error) {
          return jsonError(400, error instanceof Error ? error.message : "Invalid request");
        }

        try {
          const [row] = await sql.unsafe(query.sqlText, query.values);
          const durationMs = Math.round((performance.now() - start) * 100) / 100;
          const meta = JSON.stringify({
            count: Number(row.total),
            duration_ms: durationMs,
            query: queryMeta(params),
          });
          return new Response(`{"data":${row.data},"meta":${meta}}`, {
            headers: JSON_HEADERS,
          });
        } catch (error) {
          return jsonError(500, error instanceof Error ? error.message : "Internal server error");
        }
      },
    },
  },
  development: { hmr: false },
});

console.log(`Server is running on port ${PORT}`);
