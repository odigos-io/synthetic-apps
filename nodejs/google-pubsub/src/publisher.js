const express = require("express");
const { PubSub } = require("@google-cloud/pubsub");
const config = require("./config");

const app = express();

let ready = false;
let legacyTopic = null;
let publishMessageTopic = null;
let lastLegacyPublishedAt = null;
let lastLegacyMessageId = null;
let lastPublishMessageAt = null;
let lastPublishMessageId = null;
let lastError = null;
let publishTimer = null;

function createPayload(trigger, api) {
  return JSON.stringify({
    ts: new Date().toISOString(),
    pid: process.pid,
    role: "publisher",
    trigger,
    api,
  });
}

app.get("/healthz", (_req, res) => {
  if (!ready || lastError) {
    return res.status(503).json({
      status: "not ready",
      role: "publisher",
      ready,
      projectId: config.projectId,
      legacyTopic: config.legacyTopicName,
      publishMessageTopic: config.publishMessageTopicName,
      lastLegacyPublishedAt,
      lastLegacyMessageId,
      lastPublishMessageAt,
      lastPublishMessageId,
      error: lastError ? String(lastError.message || lastError) : null,
    });
  }

  res.json({
    status: "ok",
    role: "publisher",
    projectId: config.projectId,
    legacyTopic: config.legacyTopicName,
    publishMessageTopic: config.publishMessageTopicName,
    publishIntervalMs: config.publishIntervalMs,
    lastLegacyPublishedAt,
    lastLegacyMessageId,
    lastPublishMessageAt,
    lastPublishMessageId,
  });
});

app.post("/publish/legacy", async (_req, res) => {
  if (!ready || !legacyTopic) {
    return res.status(503).json({ error: "publisher not ready" });
  }

  try {
    const result = await publishLegacyOnce(legacyTopic, "http");
    res.json({
      status: "published",
      api: "legacy",
      messageId: result.messageId,
      topic: config.legacyTopicName,
      payload: JSON.parse(result.payload),
    });
  } catch (err) {
    lastError = err;
    console.error("[publish/legacy] http error", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.post("/publish/publish-message", async (_req, res) => {
  if (!ready || !publishMessageTopic) {
    return res.status(503).json({ error: "publisher not ready" });
  }

  try {
    const result = await publishMessageOnce(publishMessageTopic, "http");
    res.json({
      status: "published",
      api: "publishMessage",
      messageId: result.messageId,
      topic: config.publishMessageTopicName,
      payload: JSON.parse(result.payload),
    });
  } catch (err) {
    lastError = err;
    console.error("[publish/publish-message] http error", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

function createPubSubClient() {
  // Auth: set GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON path.
  // Emulator: set PUBSUB_EMULATOR_HOST (e.g. localhost:8085) — no credentials needed.
  return new PubSub({ projectId: config.projectId });
}

async function publishLegacyOnce(topic, trigger = "periodic") {
  const payload = createPayload(trigger, "legacy");

  const messageId = await topic.publish(Buffer.from(payload, "utf8"), {
    source: "nodejs-google-pubsub",
    api: "legacy",
  });

  lastLegacyPublishedAt = new Date().toISOString();
  lastLegacyMessageId = messageId;
  lastError = null;
  console.log(`[publish/legacy] messageId=${messageId} trigger=${trigger} payload=${payload}`);
  return { messageId, payload };
}

async function publishMessageOnce(topic, trigger = "periodic") {
  const payload = createPayload(trigger, "publishMessage");

  const messageId = await topic.publishMessage({
    data: Buffer.from(payload, "utf8"),
    attributes: {
      source: "nodejs-google-pubsub",
      api: "publishMessage",
    },
  });

  lastPublishMessageAt = new Date().toISOString();
  lastPublishMessageId = messageId;
  lastError = null;
  console.log(
    `[publish/publish-message] messageId=${messageId} trigger=${trigger} payload=${payload}`
  );
  return { messageId, payload };
}

async function startPublisher() {
  const pubsub = createPubSubClient();
  legacyTopic = pubsub.topic(config.legacyTopicName);
  publishMessageTopic = pubsub.topic(config.publishMessageTopicName);

  const tickPeriodic = async () => {
    try {
      await publishLegacyOnce(legacyTopic, "periodic");
    } catch (err) {
      lastError = err;
      console.error("[publish/legacy] periodic error", err);
    }

    try {
      await publishMessageOnce(publishMessageTopic, "periodic");
    } catch (err) {
      lastError = err;
      console.error("[publish/publish-message] periodic error", err);
    }
  };

  await new Promise((resolve) => setTimeout(resolve, config.startupDelayMs));
  await tickPeriodic();

  publishTimer = setInterval(() => {
    void tickPeriodic();
  }, config.publishIntervalMs);

  ready = true;
}

const server = app.listen(config.port, () => {
  console.log(
    `publisher listening on ${config.port}; publishing legacy topic=${config.legacyTopicName} and publishMessage topic=${config.publishMessageTopicName} every ${config.publishIntervalMs}ms`
  );
});

void startPublisher().catch((err) => {
  lastError = err;
  console.error("publisher startup error", err);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down publisher`);
  if (publishTimer) {
    clearInterval(publishTimer);
    publishTimer = null;
  }
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
