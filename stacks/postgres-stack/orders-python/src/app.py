import os
import time
from datetime import datetime

import psycopg2
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

PG = dict(
    host=os.environ.get("PGHOST", "postgres"),
    port=int(os.environ.get("PGPORT", "5432")),
    user=os.environ.get("PGUSER", "app"),
    password=os.environ.get("PGPASSWORD", "app"),
    dbname=os.environ.get("PGDATABASE", "stacks"),
)
USERS_URL = os.environ.get("USERS_URL", "http://users-go:8080")


def get_conn():
    return psycopg2.connect(**PG)


def wait_db():
    for _ in range(60):
        try:
            conn = get_conn()
            conn.close()
            return
        except psycopg2.OperationalError:
            time.sleep(2)
    raise RuntimeError("postgres unavailable")


def init_schema():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            amount NUMERIC(10,2) NOT NULL,
            source TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


@app.route("/health")
def health():
    conn = get_conn()
    conn.close()
    return jsonify({"status": "healthy", "stack": "postgres"})


@app.route("/orders", methods=["POST"])
def create_order():
    body = request.get_json(silent=True) or {}
    user_id = body.get("userId", "user-1")
    amount = body.get("amount", 0)
    source = body.get("source", "unknown")

    user_resp = requests.get(f"{USERS_URL}/users/{user_id}", timeout=10)
    user_resp.raise_for_status()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO orders (user_id, amount, source) VALUES (%s, %s, %s) RETURNING id",
        (user_id, amount, source),
    )
    order_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    print(f"order created id={order_id} user={user_id}")
    return jsonify({"orderId": order_id, "userId": user_id, "amount": amount})


if __name__ == "__main__":
    wait_db()
    init_schema()
    print("orders-python on :8080")
    app.run(host="0.0.0.0", port=8080)
