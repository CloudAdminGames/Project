import { SQL } from "bun";

const sql = new SQL("postgres://admin:password123@localhost:5432/inventory", {
  max: 50,
});

const VALID_COLUMNS = new Set([
  "id", "slug", "name", "released", "background_image",
  "ratings_count", "reviews_count", "ratings", "platforms",
  "parent_platforms", "genres", "tags", "developers",
  "publishers", "stores", "description_raw", "short_screenshots",
]);

const JSON_HEADERS = { "Content-Type": "application/json" };

Bun.serve({
  port: 3000,
  routes: {
    "/health": { GET: () => new Response("OK") },
    "/api/games/search": {
      GET: async (req) => {
        const start = performance.now();
        const url = new URL(req.url);
        const column = url.searchParams.get("column");
        const q = url.searchParams.get("q")?.trim() ?? "";
        const exact = url.searchParams.get("exact") === "true";

        if (!q) {
          return new Response(
            '{"error":"Missing search query parameter \'q\'"}',
            { status: 400, headers: JSON_HEADERS },
          );
        }

        // Column-specific search. Exact matching is opt-in via `exact=true`.
        if (column) {
          if (!VALID_COLUMNS.has(column)) {
            return new Response(
              `{"error":"Invalid column ${JSON.stringify(column)}"}`,
              { status: 400, headers: JSON_HEADERS },
            );
          }

          const useExactMatch = exact;
          const operator = useExactMatch ? "=" : "ILIKE";
          const value = useExactMatch ? q : `%${q}%`;
          const [row] = await sql.unsafe(
            `SELECT COALESCE(json_agg(to_jsonb(g) - 'search_text')::text, '[]') AS data, count(*) AS total FROM game g WHERE "${column}"::text ${operator} $1`,
            [value],
          );
          const ms = Math.round((performance.now() - start) * 100) / 100;
          return new Response(
            `{"data":${row.data},"meta":{"count":${row.total},"duration_ms":${ms},"column":${JSON.stringify(column)},"query":${JSON.stringify(q)},"exact":${JSON.stringify(useExactMatch)}}}`,
            { headers: JSON_HEADERS },
          );
        }

        // Full-text search across all searchable fields (uses search_text GIN index)
        const terms = q.split(/\s+/);
        const where = terms.map((_, i) => `g.search_text ILIKE $${i + 1}`).join(" AND ");
        const [row] = await sql.unsafe(
          `SELECT COALESCE(json_agg(to_jsonb(g) - 'search_text')::text, '[]') AS data, count(*) AS total FROM game g WHERE ${where}`,
          terms.map((t) => `%${t}%`),
        );
        const ms = Math.round((performance.now() - start) * 100) / 100;
        return new Response(
          `{"data":${row.data},"meta":{"count":${row.total},"duration_ms":${ms},"query":${JSON.stringify(q)}}}`,
          { headers: JSON_HEADERS },
        );
      },
    },
  },
  development: { hmr: false },
});

console.log("Server is running on port 3000");
