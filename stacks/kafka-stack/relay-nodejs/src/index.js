const express = require("express");
const { Kafka, logLevel } = require("kafkajs");

const port = Number(process.env.PORT || 8080);
const topic = process.env.KAFKA_TOPIC || "stacks-events";
const brokers = (process.env.KAFKA_BROKERS || "kafka-broker:9092").split(",");
const processorUrl = process.env.PROCESSOR_URL || "http://processor-java:8080";

const kafka = new Kafka({ clientId: "kafka-relay", brokers, logLevel: logLevel.INFO });
const consumer = kafka.consumer({ groupId: "relay-nodejs" });

let relayed = 0;
let ready = false;

const app = express();
app.get("/health", (_req, res) => {
  res.json({ status: ready ? "healthy" : "starting", stack: "kafka", relayed });
});

async function run() {
  await new Promise((r) => setTimeout(r, Number(process.env.STARTUP_DELAY_MS || 12000)));
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const value = message.value ? message.value.toString() : "";
      relayed++;
      console.log(`[relay] #${relayed} ${value}`);
      await fetch(`${processorUrl}/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value, offset: message.offset }),
      });
    },
  });
  ready = true;
}

app.listen(port, () => console.log(`relay-nodejs on :${port}`));
run().catch((e) => { console.error(e); process.exit(1); });
