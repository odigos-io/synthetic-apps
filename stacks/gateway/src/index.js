const path = require("path");
const express = require("express");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { Kafka, logLevel } = require("kafkajs");

const port = Number(process.env.PORT || 8080);

// Redis stack
const SESSION_URL = process.env.SESSION_URL || "http://session-python.stacks-redis.svc.cluster.local:8080";
const CACHE_HTTP = process.env.CACHE_HTTP || "http://cache-go.stacks-redis.svc.cluster.local:8080";
const CACHE_GRPC = process.env.CACHE_GRPC || "cache-go.stacks-redis.svc.cluster.local:50051";
const NOTIFIER_URL = process.env.NOTIFIER_URL || "http://notifier-java.stacks-redis.svc.cluster.local:8080";

// Kafka stack
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "kafka-broker.stacks-kafka.svc.cluster.local:9092").split(",");
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "stacks-events";
const INVENTORY_HTTP = process.env.INVENTORY_HTTP || "http://inventory-go.stacks-kafka.svc.cluster.local:8080";
const INVENTORY_GRPC = process.env.INVENTORY_GRPC || "inventory-go.stacks-kafka.svc.cluster.local:50051";
const ANALYTICS_URL = process.env.ANALYTICS_URL || "http://analytics-python.stacks-kafka.svc.cluster.local:8080";

// Postgres stack
const USERS_HTTP = process.env.USERS_HTTP || "http://users-go.stacks-postgres.svc.cluster.local:8080";
const USERS_GRPC = process.env.USERS_GRPC || "users-go.stacks-postgres.svc.cluster.local:50051";
const ORDERS_URL = process.env.ORDERS_URL || "http://orders-python.stacks-postgres.svc.cluster.local:8080";
const BILLING_URL = process.env.BILLING_URL || "http://billing-java.stacks-postgres.svc.cluster.local:8080";
const AUDIT_URL = process.env.AUDIT_URL || "http://audit-go.stacks-postgres.svc.cluster.local:8080";

const MESSAGING_GATEWAY = process.env.MESSAGING_GATEWAY_URL || "http://messaging-gateway.stacks-messaging.svc.cluster.local:8080";
const SEARCH_GATEWAY = process.env.SEARCH_GATEWAY_URL || "http://search-gateway.stacks-search.svc.cluster.local:8080";

const protoPath = path.join(__dirname, "proto", "lookup.proto");
const pkgDef = protoLoader.loadSync(protoPath, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const lookupProto = grpc.loadPackageDefinition(pkgDef).stacks;

const kafka = new Kafka({ clientId: "stacks-gateway", brokers: KAFKA_BROKERS, logLevel: logLevel.WARN });
const producer = kafka.producer();

function grpcLookup(addr, key) {
  return new Promise((resolve, reject) => {
    const client = new lookupProto.LookupService(addr, grpc.credentials.createInsecure());
    client.Get({ key }, (err, resp) => { client.close(); err ? reject(err) : resolve(resp); });
  });
}

async function redisStack(key, value, steps) {
  const session = await fetch(`${SESSION_URL}/session/${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  steps.push({ stack: "redis", service: "session-python", status: session.status });

  try {
    const cacheGrpc = await grpcLookup(CACHE_GRPC, key);
    steps.push({ stack: "redis", service: "cache-go", protocol: "grpc", result: cacheGrpc });
  } catch (e) {
    steps.push({ stack: "redis", service: "cache-go", protocol: "grpc", error: e.message });
  }

  const cacheHttp = await fetch(`${CACHE_HTTP}/cache/${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
  steps.push({ stack: "redis", service: "cache-go", protocol: "http", status: cacheHttp.status });

  const notify = await fetch(`${NOTIFIER_URL}/notify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  steps.push({ stack: "redis", service: "notifier-java", status: notify.status });
}

async function kafkaStack(key, value, source, steps) {
  await producer.send({
    topic: KAFKA_TOPIC,
    messages: [{ key, value: JSON.stringify({ key, value, source, ts: new Date().toISOString() }) }],
  });
  steps.push({ stack: "kafka", service: "kafka-broker", action: "produce", topic: KAFKA_TOPIC });

  const inv = await fetch(`${INVENTORY_HTTP}/inventory/${encodeURIComponent(key)}`);
  steps.push({ stack: "kafka", service: "inventory-go", protocol: "http", status: inv.status });

  try {
    const invGrpc = await grpcLookup(INVENTORY_GRPC, key);
    steps.push({ stack: "kafka", service: "inventory-go", protocol: "grpc", result: invGrpc });
  } catch (e) {
    steps.push({ stack: "kafka", service: "inventory-go", protocol: "grpc", error: e.message });
  }

  const analytics = await fetch(`${ANALYTICS_URL}/record`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `${source}:${key}=${value}` }),
  });
  steps.push({ stack: "kafka", service: "analytics-python", status: analytics.status });
}

async function postgresStack(userId, amount, source, action, steps) {
  const user = await fetch(`${USERS_HTTP}/users/${encodeURIComponent(userId)}`);
  steps.push({ stack: "postgres", service: "users-go", protocol: "http", status: user.status });

  try {
    const userGrpc = await grpcLookup(USERS_GRPC, userId);
    steps.push({ stack: "postgres", service: "users-go", protocol: "grpc", result: userGrpc });
  } catch (e) {
    steps.push({ stack: "postgres", service: "users-go", protocol: "grpc", error: e.message });
  }

  const order = await fetch(`${ORDERS_URL}/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, amount, source }),
  });
  steps.push({ stack: "postgres", service: "orders-python", status: order.status });

  const billing = await fetch(`${BILLING_URL}/charge`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, amount }),
  });
  steps.push({ stack: "postgres", service: "billing-java", status: billing.status });

  const audit = await fetch(`${AUDIT_URL}/audit`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, amount, source, action }),
  });
  steps.push({ stack: "postgres", service: "audit-go", status: audit.status });
}

async function messagingStack(txn, key, value, steps) {
  const resp = await fetch(`${MESSAGING_GATEWAY}/transactions/${txn}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  steps.push({ stack: "messaging", gateway: txn, status: resp.status, body: await resp.json().catch(() => ({})) });
}

async function searchStack(txn, key, userId, value, steps) {
  const body = txn === "ship-order"
    ? { orderId: key, customerId: userId, key }
    : { customerId: userId, id: key, key, body: value || `data-${key}` };
  const resp = await fetch(`${SEARCH_GATEWAY}/transactions/${txn}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  steps.push({ stack: "search", gateway: txn, status: resp.status, body: await resp.json().catch(() => ({})) });
}

function valueOr(key) { return `data-${key}`; }

const app = express();
app.use(express.json());

let ready = false;

app.get("/health", (_req, res) => {
  res.json({ status: ready ? "healthy" : "starting", gateway: "stacks-gateway" });
});

app.get("/transactions", (_req, res) => {
  res.json({
    transactions: [
      { name: "place-order", method: "POST", path: "/transactions/place-order", stacks: "redis → kafka → postgres" },
      { name: "sync-catalog", method: "POST", path: "/transactions/sync-catalog", stacks: "kafka → postgres → redis" },
      { name: "fulfill-shipment", method: "POST", path: "/transactions/fulfill-shipment", stacks: "postgres → redis → kafka" },
      { name: "publish-product", method: "POST", path: "/transactions/publish-product", stacks: "messaging (mongo + rabbitmq)" },
      { name: "apply-pricing", method: "POST", path: "/transactions/apply-pricing", stacks: "messaging (quarkus + rabbitmq)" },
      { name: "sync-recommendations", method: "POST", path: "/transactions/sync-recommendations", stacks: "messaging (gin + fastapi)" },
      { name: "customer-lookup", method: "POST", path: "/transactions/customer-lookup", stacks: "search (django + es + memcached)" },
      { name: "index-document", method: "POST", path: "/transactions/index-document", stacks: "search (indexer + django)" },
      { name: "ship-order", method: "POST", path: "/transactions/ship-order", stacks: "search (php + es)" },
      { name: "platform-wide", method: "POST", path: "/transactions/platform-wide", stacks: "all 5 stacks" },
    ],
  });
});

async function runTransaction(name, handler, req, res) {
  const key = req.body.key || req.body.userId || "item-1";
  const value = req.body.value || "default";
  const userId = req.body.userId || key;
  const amount = req.body.amount || 19.99;
  const steps = [];

  res.set("X-Transaction-Name", name);
  console.log(`[transaction:${name}] start key=${key}`);

  try {
    await handler({ key, value, userId, amount, steps });
    console.log(`[transaction:${name}] done key=${key} steps=${steps.length}`);
    res.json({ transaction: name, key, userId, amount, steps });
  } catch (err) {
    console.error(`[transaction:${name}] error`, err);
    res.status(500).json({ transaction: name, error: String(err.message), steps });
  }
}

// Transaction 1: classic e-commerce order — redis session/cache → kafka inventory → postgres checkout
app.post("/transactions/place-order", (req, res) =>
  runTransaction("place-order", async ({ key, value, userId, amount, steps }) => {
    await redisStack(key, value, steps);
    await kafkaStack(key, value, "place-order", steps);
    await postgresStack(userId, amount, "place-order", "place-order", steps);
  }, req, res)
);

// Transaction 2: catalog sync — kafka event → postgres audit → redis cache warm
app.post("/transactions/sync-catalog", (req, res) =>
  runTransaction("sync-catalog", async ({ key, value, userId, amount, steps }) => {
    await kafkaStack(key, value, "sync-catalog", steps);
    await postgresStack(userId, amount, "sync-catalog", "sync-catalog", steps);
    await redisStack(key, value, steps);
  }, req, res)
);

// Transaction 3: shipment fulfillment — postgres billing first → redis notify → kafka publish
app.post("/transactions/fulfill-shipment", (req, res) =>
  runTransaction("fulfill-shipment", async ({ key, value, userId, amount, steps }) => {
    await postgresStack(userId, amount, "fulfill-shipment", "fulfill-shipment", steps);
    await redisStack(key, value, steps);
    await kafkaStack(key, value, "fulfill-shipment", steps);
  }, req, res)
);

app.post("/transactions/publish-product", (req, res) =>
  runTransaction("publish-product", async ({ key, value, steps }) => {
    await messagingStack("publish-product", key, value, steps);
  }, req, res)
);

app.post("/transactions/apply-pricing", (req, res) =>
  runTransaction("apply-pricing", async ({ key, value, steps }) => {
    await messagingStack("apply-pricing", key, value, steps);
  }, req, res)
);

app.post("/transactions/sync-recommendations", (req, res) =>
  runTransaction("sync-recommendations", async ({ key, value, steps }) => {
    await messagingStack("sync-recommendations", key, value, steps);
  }, req, res)
);

app.post("/transactions/customer-lookup", (req, res) =>
  runTransaction("customer-lookup", async ({ key, userId, value, steps }) => {
    await searchStack("customer-lookup", key, userId, value, steps);
  }, req, res)
);

app.post("/transactions/index-document", (req, res) =>
  runTransaction("index-document", async ({ key, userId, value, steps }) => {
    await searchStack("index-document", key, userId, value, steps);
  }, req, res)
);

app.post("/transactions/ship-order", (req, res) =>
  runTransaction("ship-order", async ({ key, userId, value, steps }) => {
    await searchStack("ship-order", key, userId, value, steps);
  }, req, res)
);

app.post("/transactions/platform-wide", (req, res) =>
  runTransaction("platform-wide", async ({ key, value, userId, amount, steps }) => {
    await redisStack(key, value, steps);
    await kafkaStack(key, value, "platform-wide", steps);
    await postgresStack(userId, amount, "platform-wide", "platform-wide", steps);
    await messagingStack("publish-product", key, value, steps);
    await searchStack("customer-lookup", key, userId, value, steps);
  }, req, res)
);

async function startup() {
  await new Promise((r) => setTimeout(r, Number(process.env.STARTUP_DELAY_MS || 5000)));
  await producer.connect();
  ready = true;
  console.log("stacks-gateway ready — 10 transactions across 5 stacks");
}

app.listen(port, () => console.log(`stacks-gateway on :${port}`));
startup().catch((e) => { console.error(e); process.exit(1); });

process.on("SIGTERM", async () => { await producer.disconnect().catch(() => {}); process.exit(0); });
