const path = require("path");
const express = require("express");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { Kafka, logLevel } = require("kafkajs");

const port = Number(process.env.PORT || 8080);
const topic = process.env.KAFKA_TOPIC || "stacks-events";
const brokers = (process.env.KAFKA_BROKERS || "kafka-broker:9092").split(",");
const inventoryUrl = process.env.INVENTORY_URL || "http://inventory-go:8080";
const inventoryGrpc = process.env.INVENTORY_GRPC_ADDR || "inventory-go:50051";
const postgresGatewayUrl =
  process.env.POSTGRES_GATEWAY_URL ||
  "http://postgres-gateway.stacks-postgres.svc.cluster.local:8080";

const kafka = new Kafka({ clientId: "kafka-gateway", brokers, logLevel: logLevel.INFO });
const producer = kafka.producer();

const protoPath = path.join(__dirname, "..", "proto", "lookup.proto");
const pkgDef = protoLoader.loadSync(protoPath, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const lookupProto = grpc.loadPackageDefinition(pkgDef).stacks;

function grpcLookup(key) {
  return new Promise((resolve, reject) => {
    const client = new lookupProto.LookupService(inventoryGrpc, grpc.credentials.createInsecure());
    client.Get({ key }, (err, resp) => { client.close(); err ? reject(err) : resolve(resp); });
  });
}

const app = express();
app.use(express.json());
let ready = false;

app.get("/health", (_req, res) => {
  res.json({ status: ready ? "healthy" : "starting", stack: "kafka" });
});

app.post("/event", async (req, res) => {
  const key = req.body.key || "event-1";
  const value = req.body.value || "demo";
  const source = req.body.source || "kafka-stack";
  const steps = [];

  try {
    await producer.send({
      topic,
      messages: [{ key, value: JSON.stringify({ key, value, source, ts: new Date().toISOString() }) }],
    });
    steps.push({ step: "kafka-produce", topic });

    const invResp = await fetch(`${inventoryUrl}/inventory/${encodeURIComponent(key)}`);
    steps.push({ step: "inventory-http", status: invResp.status, body: await invResp.json() });

    try {
      const grpcResult = await grpcLookup(key);
      steps.push({ step: "inventory-grpc", result: grpcResult });
    } catch (e) {
      steps.push({ step: "inventory-grpc", error: String(e.message) });
    }

    try {
      const pgResp = await fetch(`${postgresGatewayUrl}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: key, amount: 9.99, source }),
      });
      steps.push({ step: "postgres-stack-cross", status: pgResp.status });
    } catch (e) {
      steps.push({ step: "postgres-stack-cross", error: String(e.message) });
    }

    console.log(`event key=${key}`, steps);
    res.json({ key, steps });
  } catch (err) {
    res.status(500).json({ error: String(err.message), steps });
  }
});

async function startup() {
  await new Promise((r) => setTimeout(r, Number(process.env.STARTUP_DELAY_MS || 10000)));
  await producer.connect();
  ready = true;
  console.log(`kafka gateway ready topic=${topic}`);
}

app.listen(port, () => console.log(`kafka gateway on :${port}`));
startup().catch((e) => { console.error(e); process.exit(1); });
