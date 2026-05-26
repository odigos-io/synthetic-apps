import os

from flask import Flask, jsonify

app = Flask(__name__)
PORT = int(os.environ.get("PORT", "8070"))


@app.get("/healthz")
def healthz():
    return jsonify(status="healthy", language="python")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
