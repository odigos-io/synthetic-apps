const express = require("express");
const { PubSub } = require("@google-cloud/pubsub");
const config = require("./config");
const { trace } = require("@opentelemetry/api");

const app = express();

const tracer = trace.getTracer("nodejs-google-pubsub");

let ready = false;
let lastConsumedAt = null;
let lastMessageId = null;
let lastError = null;
let messagesProcessed = 0;

app.get("/healthz", (_req, res) => {
  if (!ready || lastError) {
    return res.status(503).json({
      status: "not ready",
      role: "consumer",
      api: "publishMessage",
      ready,
      projectId: config.projectId,
      subscription: config.publishMessageSubscriptionName,
      messagesProcessed,
      lastConsumedAt,
      lastMessageId,
      error: lastError ? String(lastError.message || lastError) : null,
    });
  }

  res.json({
    status: "ok",
    role: "consumer",
    api: "publishMessage",
    projectId: config.projectId,
    subscription: config.publishMessageSubscriptionName,
    messagesProcessed,
    lastConsumedAt,
    lastMessageId,
  });
});

app.get("/process/publish-message", (_req, res) => {
  res.json({ endpoint: "/process/publish-message", api: "publishMessage", status: "ok" });
});

function createPubSubClient() {
  // Auth: set GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON path.
  // Emulator: set PUBSUB_EMULATOR_HOST (e.g. localhost:8085) — no credentials needed.
  return new PubSub({ projectId: config.projectId });
}

async function processPublishMessage(message) {
  await new Promise((resolve) => setTimeout(resolve, config.processDelayMs));

  const response = await fetch(`http://127.0.0.1:${config.port}/process/publish-message`);
  if (!response.ok) {
    throw new Error(`process/publish-message failed: status ${response.status}`);
  }
}

function handlePubSubMessage(message) {
  const payload = message.data.toString("utf8");

  void (async () => {
    try {
      await processPublishMessage(message);
      message.ack();

      messagesProcessed += 1;
      lastConsumedAt = new Date().toISOString();
      lastMessageId = message.id;
      lastError = null;

      console.log(
        `[consume/publish-message] messageId=${message.id} publishTime=${message.publishTime} payload=${payload}`
      );
    } catch (err) {
      lastError = err;
      message.nack();
      console.error(`[consume/publish-message] error messageId=${message.id}`, err);
    }
  })();
}

async function startPublishMessageConsumer() {
  const pubsub = createPubSubClient();
  const subscription = pubsub.subscription(config.publishMessageSubscriptionName);

  subscription.on("message", handlePubSubMessage);
  subscription.on("error", (err) => {
    lastError = err;
    console.error("[consume/publish-message] subscription error", err);
  });

  await new Promise((resolve) => setTimeout(resolve, config.startupDelayMs));
  ready = true;
  console.log(
    `consumer listening on publish-message subscription=${config.publishMessageSubscriptionName}`
  );
}

const server = app.listen(config.port, () => {
  console.log(
    `consumer http listening on ${config.port} (healthz, /process/publish-message)`
  );
});

void startPublishMessageConsumer().catch((err) => {
  lastError = err;
  console.error("consumer startup error", err);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down consumer`);
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
