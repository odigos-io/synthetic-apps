import os
import time
from datetime import datetime

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongodb.stacks-messaging.svc.cluster.local:27017")
QUARKUS_URL = os.environ.get("QUARKUS_URL", "http://quarkus-pricing:8080")

app = FastAPI(title="fastapi-products")
client = None
db = None


def get_db():
    global client, db
    if db is None:
        for _ in range(60):
            try:
                client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
                client.admin.command("ping")
                db = client["stacks"]
                db.products.create_index("sku", unique=True)
                break
            except Exception:
                time.sleep(2)
    return db


class Product(BaseModel):
    sku: str
    name: str
    price: float = 0.0


@app.get("/health")
def health():
    get_db()
    return {"status": "healthy", "stack": "messaging", "framework": "fastapi"}


@app.post("/products")
def create_product(p: Product):
    col = get_db().products
    doc = {"sku": p.sku, "name": p.name, "price": p.price, "updated": datetime.utcnow().isoformat()}
    col.update_one({"sku": p.sku}, {"$set": doc}, upsert=True)
    print(f"[fastapi] upsert sku={p.sku}")
    return doc


@app.get("/products/{sku}")
def get_product(sku: str):
    doc = get_db().products.find_one({"sku": sku}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "not found")
    try:
        requests.get(f"{QUARKUS_URL}/price/{sku}", timeout=5)
    except Exception:
        pass
    return doc
