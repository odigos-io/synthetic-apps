const path = require("path");
const express = require("express");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const port = Number(process.env.PORT || 8080);
const sessionUrl = process.env.SESSION_URL || "http://session-python:8080";
const cacheGrpcAddr = process.env.CACHE_GRPC_ADDR || "cache-go:50051";
const notifierUrl = process.env.NOTIFIER_URL || "http://notifier-java:8080";
const workerUrl = process.env.WORKER_URL || "http://worker-nodejs:8080";
const kafkaGatewayUrl =
  process.env.KAFKA_GATEWAY_URL ||
  "http://kafka-gateway.stacks-kafka.svc.cluster.local:8080";

const protoPath = path.join(__dirname, "..", "proto", "lookup.proto");
const pkgDef = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const lookupProto = grpc.loadPackageDefinition(pkgDef).stacks;

function grpcLookup(key) {
  return new Promise((resolve, reject) => {
    const client = new lookupProto.LookupService(
      cacheGrpcAddr,
      grpc.credentials.createInsecure()
    );
    client.Get({ key }, (err, resp) => {
      client.close();
      if (err) reject(err);
      else resolve(resp);
    });
  });
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "healthy", stack: "redis" });
});

app.post("/flow", async (req, res) => {
  const key = req.body.key || "item-1";
  const value = req.body.value || "demo-value";
  const steps = [];

  try {
    const sessionResp = await fetch(`${sessionUrl}/session/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    steps.push({ step: "session", status: sessionResp.status });

    let cacheResult;
    try {
      cacheResult = await grpcLookup(key);
      steps.push({ step: "cache-grpc", result: cacheResult });
    } catch (e) {
      steps.push({ step: "cache-grpc", error: String(e.message) });
    }

    const notifyResp = await fetch(`${notifierUrl}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    steps.push({ step: "notifier", status: notifyResp.status });

    const workerResp = await fetch(`${workerUrl}/stats`);
    steps.push({ step: "worker-stats", body: await workerResp.json() });

    try {
      const crossResp = await fetch(`${kafkaGatewayUrl}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, source: "redis-stack" }),
      });
      steps.push({ step: "kafka-stack-cross", status: crossResp.status });
    } catch (e) {
      steps.push({ step: "kafka-stack-cross", error: String(e.message) });
    }

    console.log(`flow completed key=${key}`, steps);
    res.json({ key, steps });
  } catch (err) {
    console.error("flow error", err);
    res.status(500).json({ error: String(err.message), steps });
  }
});

app.listen(port, () => console.log(`redis gateway on :${port}`));
