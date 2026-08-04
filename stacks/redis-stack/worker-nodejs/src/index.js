const express = require("express");
const { createClient } = require("redis");

const port = Number(process.env.PORT || 8080);
const redisHost = process.env.REDIS_HOST || "redis";
const redisPort = Number(process.env.REDIS_DB_PORT || 6379);

let processed = 0;
let lastMessage = "";
let ready = false;

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: ready ? "healthy" : "starting", stack: "redis" });
});

app.get("/stats", (_req, res) => {
  res.json({ processed, lastMessage });
});

async function run() {
  const client = createClient({ url: `redis://${redisHost}:${redisPort}` });
  client.on("error", (e) => console.error("redis error", e));
  await client.connect();

  ready = true;
  console.log("worker listening on redis queue notifications");

  while (true) {
    const result = await client.brPop("notifications", 0);
    const msg = result.element;
    processed++;
    lastMessage = msg;
    console.log(`[worker] processed #${processed}: ${msg}`);
  }
}

app.listen(port, () => console.log(`worker-nodejs on :${port}`));
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
