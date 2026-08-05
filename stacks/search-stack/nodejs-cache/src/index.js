const Fastify = require("fastify");
const memjs = require("memjs");

const port = Number(process.env.PORT || 8080);
const memHost = process.env.MEMCACHED_HOST || "memcached.stacks-search.svc.cluster.local";
const memPort = Number(process.env.MEMCACHED_DB_PORT || 11211);
const indexerUrl = process.env.INDEXER_URL || "http://go-indexer:8080";

const client = memjs.Client.create(`${memHost}:${memPort}`, { retries: 2, timeout: 1 });

const app = Fastify({ logger: false });

app.get("/health", async () => {
  await client.get("health-check").catch(() => client.set("health-check", "ok", { expires: 60 }));
  return { status: "healthy", stack: "search", framework: "fastify" };
});

app.get("/cache/:key", async (req) => {
  const key = req.params.key;
  const hit = await client.get(key);
  if (hit.value) {
    return { source: "memcached", key, value: hit.value.toString() };
  }
  const resp = await fetch(`${indexerUrl}/search?q=${encodeURIComponent(key)}`);
  const body = await resp.text();
  await client.set(key, body.slice(0, 500), { expires: 300 });
  return { source: "elasticsearch", key, cached: true };
});

app.post("/cache/:key", async (req) => {
  const key = req.params.key;
  const value = (req.body && req.body.value) || "cached";
  await client.set(key, value, { expires: 300 });
  return { key, stored: true };
});

app.listen({ port, host: "0.0.0.0" }, () => {
  console.log(`nodejs-cache (Fastify) on :${port}`);
});
