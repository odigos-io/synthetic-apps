const path = require("path");
const express = require("express");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const port = Number(process.env.PORT || 8080);
const usersUrl = process.env.USERS_URL || "http://users-go:8080";
const usersGrpc = process.env.USERS_GRPC_ADDR || "users-go:50051";
const ordersUrl = process.env.ORDERS_URL || "http://orders-python:8080";
const billingUrl = process.env.BILLING_URL || "http://billing-java:8080";
const auditUrl = process.env.AUDIT_URL || "http://audit-go:8080";
const redisGatewayUrl =
  process.env.REDIS_GATEWAY_URL ||
  "http://redis-gateway.stacks-redis.svc.cluster.local:8080";

const protoPath = path.join(__dirname, "..", "proto", "lookup.proto");
const pkgDef = protoLoader.loadSync(protoPath, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const lookupProto = grpc.loadPackageDefinition(pkgDef).stacks;

function grpcLookup(key) {
  return new Promise((resolve, reject) => {
    const client = new lookupProto.LookupService(usersGrpc, grpc.credentials.createInsecure());
    client.Get({ key }, (err, resp) => { client.close(); err ? reject(err) : resolve(resp); });
  });
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "healthy", stack: "postgres" });
});

app.post("/checkout", async (req, res) => {
  const userId = req.body.userId || "user-1";
  const amount = req.body.amount || 9.99;
  const source = req.body.source || "postgres-stack";
  const steps = [];

  try {
    const userResp = await fetch(`${usersUrl}/users/${encodeURIComponent(userId)}`);
    steps.push({ step: "users-http", status: userResp.status, body: await userResp.json() });

    try {
      const grpcResult = await grpcLookup(userId);
      steps.push({ step: "users-grpc", result: grpcResult });
    } catch (e) {
      steps.push({ step: "users-grpc", error: String(e.message) });
    }

    const orderResp = await fetch(`${ordersUrl}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount, source }),
    });
    steps.push({ step: "orders", status: orderResp.status, body: await orderResp.json() });

    const billResp = await fetch(`${billingUrl}/charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount }),
    });
    steps.push({ step: "billing", status: billResp.status, body: await billResp.json() });

    const auditResp = await fetch(`${auditUrl}/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount, source, action: "checkout" }),
    });
    steps.push({ step: "audit", status: auditResp.status, body: await auditResp.json() });

    try {
      const crossResp = await fetch(`${redisGatewayUrl}/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: userId, value: `checkout-${amount}` }),
      });
      steps.push({ step: "redis-stack-cross", status: crossResp.status });
    } catch (e) {
      steps.push({ step: "redis-stack-cross", error: String(e.message) });
    }

    console.log(`checkout userId=${userId}`, steps);
    res.json({ userId, amount, steps });
  } catch (err) {
    res.status(500).json({ error: String(err.message), steps });
  }
});

app.listen(port, () => console.log(`postgres gateway on :${port}`));
