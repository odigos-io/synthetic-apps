import json
import os
import threading
import time
from datetime import datetime

from flask import Flask, jsonify, request
from kafka import KafkaConsumer

app = Flask(__name__)

BROKERS = os.environ.get("KAFKA_BROKERS", "kafka-broker:9092")
TOPIC = os.environ.get("KAFKA_TOPIC", "stacks-events")
GROUP = os.environ.get("KAFKA_GROUP_ID", "analytics-python")

records = []
kafka_count = 0


def consume_kafka():
    global kafka_count
    time.sleep(12)
    consumer = KafkaConsumer(
        TOPIC,
        bootstrap_servers=BROKERS.split(","),
        group_id=GROUP,
        auto_offset_reset="earliest",
        value_deserializer=lambda m: m.decode("utf-8"),
    )
    print(f"analytics kafka consumer started topic={TOPIC}")
    for msg in consumer:
        kafka_count += 1
        print(f"[analytics-kafka] {msg.value}")
        records.append({"source": "kafka", "message": msg.value, "ts": datetime.now().isoformat()})


@app.route("/health")
def health():
    return jsonify({"status": "healthy", "stack": "kafka", "kafkaCount": kafka_count})


@app.route("/record", methods=["POST"])
def record():
    body = request.get_json(silent=True) or {}
    records.append({"source": "http", "message": body.get("message", ""), "ts": datetime.now().isoformat()})
    print(f"[analytics-http] {body}")
    return jsonify({"recorded": True, "total": len(records)})


@app.route("/stats")
def stats():
    return jsonify({"total": len(records), "kafkaCount": kafka_count, "recent": records[-5:]})


if __name__ == "__main__":
    threading.Thread(target=consume_kafka, daemon=True).start()
    print("analytics-python on :8080")
    app.run(host="0.0.0.0", port=8080)
