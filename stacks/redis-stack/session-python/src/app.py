import os
import time
from datetime import datetime

import redis
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_DB_PORT", "6379"))
CACHE_URL = os.environ.get("CACHE_URL", "http://cache-go:8080")

_redis = None


def get_redis():
    global _redis
    if _redis is None:
        _redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    return _redis


def wait_for_redis():
    for _ in range(60):
        try:
            get_redis().ping()
            return
        except redis.RedisError:
            time.sleep(2)
    raise RuntimeError("redis unavailable")


@app.route("/health")
def health():
    get_redis().ping()
    return jsonify({"status": "healthy", "stack": "redis"})


@app.route("/session/<session_id>", methods=["GET", "POST"])
def session(session_id):
    r = get_redis()
    if request.method == "GET":
        data = r.hgetall(f"session:{session_id}")
        return jsonify({"id": session_id, "data": data})

    body = request.get_json(silent=True) or {}
    value = body.get("value", "")
    r.hset(f"session:{session_id}", mapping={"value": value, "updated": datetime.now().isoformat()})
    print(f"session stored id={session_id}")

    cache_resp = requests.get(f"{CACHE_URL}/cache/{session_id}", timeout=10)
    print(f"cache warm status={cache_resp.status_code}")
    return jsonify({"id": session_id, "stored": True, "cacheStatus": cache_resp.status_code})


if __name__ == "__main__":
    wait_for_redis()
    print("session-python on :8080")
    app.run(host="0.0.0.0", port=8080)
