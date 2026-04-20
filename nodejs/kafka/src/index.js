const express = require("express");
const { Kafka, logLevel } = require("kafkajs");

const port = Number(process.env.PORT || 8080);
const topic = process.env.KAFKA_TOPIC || "synthetic-kafka";
const brokers = (process.env.KAFKA_BROKERS || "kafka-broker:9092")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const clientId = process.env.KAFKA_CLIENT_ID || "nodejs-kafka";
const groupId = process.env.KAFKA_GROUP_ID || "synthetic-kafka-group";

const kafkaClient = new Kafka({
  clientId,
  brokers,
  logLevel: logLevel.INFO,
});

const producer = kafkaClient.producer();
const consumer = kafkaClient.consumer({ groupId });

let lastConsumedAt = null;
let lastProducedAt = null;
let lastError = null;
let ready = false;

const app = express();

app.get("/healthz", (_req, res) => {
  if (!ready || lastError) {
    return res.status(503).json({
      status: "not ready",
      ready,
      error: lastError ? String(lastError.message || lastError) : null,
    });
  }
  res.json({
    status: "ok",
    topic,
    brokers,
    lastProducedAt,
    lastConsumedAt,
  });
});

async function run() {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  consumer
    .run({
      eachMessage: async ({ message }) => {
        lastConsumedAt = new Date().toISOString();
        console.log(
          `[consume] offset=%s key=%s value=%s`,
          message.offset,
          message.key ? message.key.toString() : "",
          message.value ? message.value.toString() : ""
        );
      },
    })
    .catch((err) => {
      lastError = err;
      console.error("consumer.run error", err);
    });

  const sendLoop = async () => {
    const payload = JSON.stringify({
      ts: new Date().toISOString(),
      pid: process.pid,
    });
    try {
      await producer.send({
        topic,
        messages: [{ key: String(process.pid), value: payload }],
      });
      lastProducedAt = new Date().toISOString();
      lastError = null;
    } catch (err) {
      lastError = err;
      console.error("producer.send error", err);
    }
  };

  await new Promise((r) =>
    setTimeout(r, Number(process.env.STARTUP_DELAY_MS || 3000))
  );
  await sendLoop();
  setInterval(sendLoop, Number(process.env.PRODUCE_INTERVAL_MS || 5000));

  ready = true;
}

app.listen(port, () => {
  console.log(`listening on ${port}, brokers=${brokers.join(",")} topic=${topic}`);
});

run().catch((err) => {
  lastError = err;
  console.error("startup error", err);
  process.exit(1);
});
