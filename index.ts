import { SQL } from "bun";

const PORT = 3000;

const sql = new SQL("postgres://admin:password123@localhost:5432/inventory");

Bun.serve({
  port: PORT,
  routes: {
    "/health": {
      GET: () => new Response("OK", { status: 200 }),
    },
    "/api/games": {
        GET: async () => {
            const games = await sql`SELECT * FROM games LIMIT 10`;
            return Response.json(games);
          },
    },
  },
  development: {
    hmr: true,
  },
});

console.log(`Server is running on port ${PORT}`);