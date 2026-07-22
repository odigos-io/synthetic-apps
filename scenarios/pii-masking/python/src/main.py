import os
import signal
import sys
import threading
from typing import Any

from flask import Flask, jsonify, request
from opentelemetry import trace

app = Flask(__name__)

PORT = 8080
SHUTDOWN_TIMEOUT_SEC = 10

tracer = trace.get_tracer("pii-masking")

# Sample PII values (same as the nodejs curl job) for masking assertions.
VISA = "4111111111111111"
MASTERCARD = "5555555555554444"
EMAIL = "user@example.com"
JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJzdWIiOiIxMjM0NTY3ODkwIn0."
    "dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
)
UUID = "550e8400-e29b-41d4-a716-446655440000"

# Custom-format / custom-regex samples (see pii-masking-action.yaml).
EMPLOYEE_SSN = "123-45-6789"
EMPLOYEE_SSN_ALT = "987-65-4321"
TENANT = "acme-corp"
SECRET_TOKEN = "secret_ABC123XYZ"
SECRET_TOKEN_ALT = "secret_DEF456UVW"
ACCOUNT_ID = "acct_9f3a2b1c"
ACCOUNT_ID_ALT = "acct_7c8d9e0f"

_server = None
_force_exit_timer: threading.Timer | None = None


@app.after_request
def _log_request(response):
    print(f"{request.method} {request.path} -> {response.status_code}", flush=True)
    return response


@app.get("/healthz")
def healthz():
    return jsonify({"status": "healthy"}), 200


@app.get("/span/credit-card")
def span_credit_card():
    visa_embedded = f"customer paid with card {VISA} today"
    visa_multi = f"primary={VISA} backup={VISA}"
    mastercard_embedded = f"charge applied to {MASTERCARD} at checkout"
    mastercard_multi = f"{MASTERCARD} then {MASTERCARD} again"
    with tracer.start_as_current_span("pii.credit_card") as span:
        span.set_attribute("pii.category", "CREDIT_CARD")
        span.set_attribute("visa", VISA)
        span.set_attribute("visa.embedded", visa_embedded)
        span.set_attribute("visa.multi", visa_multi)
        span.set_attribute("mastercard", MASTERCARD)
        span.set_attribute("mastercard.embedded", mastercard_embedded)
        span.set_attribute("mastercard.multi", mastercard_multi)
        return jsonify(
            {
                "endpoint": "/span/credit-card",
                "span": "pii.credit_card",
                "attributes": {
                    "visa": VISA,
                    "visa.embedded": visa_embedded,
                    "visa.multi": visa_multi,
                    "mastercard": MASTERCARD,
                    "mastercard.embedded": mastercard_embedded,
                    "mastercard.multi": mastercard_multi,
                },
            }
        ), 200


@app.get("/span/email")
def span_email():
    email_embedded = f"please contact {EMAIL} for support"
    email_multi = f"to={EMAIL} cc={EMAIL}"
    with tracer.start_as_current_span("pii.email") as span:
        span.set_attribute("pii.category", "EMAIL")
        span.set_attribute("email", EMAIL)
        span.set_attribute("email.embedded", email_embedded)
        span.set_attribute("email.multi", email_multi)
        return jsonify(
            {
                "endpoint": "/span/email",
                "span": "pii.email",
                "attributes": {
                    "email": EMAIL,
                    "email.embedded": email_embedded,
                    "email.multi": email_multi,
                },
            }
        ), 200


@app.get("/span/jwt")
def span_jwt():
    token_embedded = f"Authorization: Bearer {JWT} for session"
    token_multi = f"access={JWT}; refresh={JWT}"
    with tracer.start_as_current_span("pii.jwt") as span:
        span.set_attribute("pii.category", "JWT")
        span.set_attribute("token", JWT)
        span.set_attribute("token.embedded", token_embedded)
        span.set_attribute("token.multi", token_multi)
        return jsonify(
            {
                "endpoint": "/span/jwt",
                "span": "pii.jwt",
                "attributes": {
                    "token": JWT,
                    "token.embedded": token_embedded,
                    "token.multi": token_multi,
                },
            }
        ), 200


@app.get("/span/uuid")
def span_uuid():
    id_embedded = f"resource path /users/{UUID}/profile"
    id_multi = f"from={UUID} to={UUID}"
    with tracer.start_as_current_span("pii.uuid") as span:
        span.set_attribute("pii.category", "UUID")
        span.set_attribute("id", UUID)
        span.set_attribute("id.embedded", id_embedded)
        span.set_attribute("id.multi", id_multi)
        return jsonify(
            {
                "endpoint": "/span/uuid",
                "span": "pii.uuid",
                "attributes": {
                    "id": UUID,
                    "id.embedded": id_embedded,
                    "id.multi": id_multi,
                },
            }
        ), 200


@app.get("/span/custom-format")
def span_custom_format():
    """Attributes shaped for customFormatMaskings (json / sql / resource_path)."""
    json_full = f'{{"employee_ssn":"{EMPLOYEE_SSN}","name":"alice"}}'
    json_embedded = f'payload={{"employee_ssn":"{EMPLOYEE_SSN}"}} processed'
    json_multi = (
        f'{{"employee_ssn":"{EMPLOYEE_SSN}"}} and '
        f'{{"employee_ssn":"{EMPLOYEE_SSN_ALT}"}}'
    )

    sql_full = f"SELECT * FROM users WHERE employee_ssn = '{EMPLOYEE_SSN}'"
    sql_embedded = f"audit log: ran SELECT name FROM users WHERE employee_ssn = '{EMPLOYEE_SSN}' ok"
    sql_multi = (
        f"employee_ssn = '{EMPLOYEE_SSN}' OR employee_ssn = '{EMPLOYEE_SSN_ALT}'"
    )

    path_full = f"/api/v1/tenants/{TENANT}/orders/42"
    path_embedded = f"upstream called GET /api/v1/tenants/{TENANT}/orders/42"
    path_multi = f"/tenants/{TENANT}/a /tenants/{TENANT}/b"

    with tracer.start_as_current_span("pii.custom_format") as span:
        span.set_attribute("pii.category", "CUSTOM_FORMAT")
        span.set_attribute("custom.json", json_full)
        span.set_attribute("custom.json.embedded", json_embedded)
        span.set_attribute("custom.json.multi", json_multi)
        span.set_attribute("custom.sql", sql_full)
        span.set_attribute("custom.sql.embedded", sql_embedded)
        span.set_attribute("custom.sql.multi", sql_multi)
        span.set_attribute("custom.resource_path", path_full)
        span.set_attribute("custom.resource_path.embedded", path_embedded)
        span.set_attribute("custom.resource_path.multi", path_multi)
        return jsonify(
            {
                "endpoint": "/span/custom-format",
                "span": "pii.custom_format",
                "attributes": {
                    "custom.json": json_full,
                    "custom.json.embedded": json_embedded,
                    "custom.json.multi": json_multi,
                    "custom.sql": sql_full,
                    "custom.sql.embedded": sql_embedded,
                    "custom.sql.multi": sql_multi,
                    "custom.resource_path": path_full,
                    "custom.resource_path.embedded": path_embedded,
                    "custom.resource_path.multi": path_multi,
                },
            }
        ), 200


@app.get("/span/custom-regex")
def span_custom_regex():
    """Attributes shaped for customRegexMaskings (capture-group masking)."""
    secret_embedded = f"Authorization header has {SECRET_TOKEN} for client"
    secret_multi = f"{SECRET_TOKEN} then {SECRET_TOKEN_ALT}"
    acct_embedded = f"billing account {ACCOUNT_ID} charged"
    acct_multi = f"{ACCOUNT_ID} and {ACCOUNT_ID_ALT}"

    with tracer.start_as_current_span("pii.custom_regex") as span:
        span.set_attribute("pii.category", "CUSTOM_REGEX")
        span.set_attribute("custom.regex.secret", SECRET_TOKEN)
        span.set_attribute("custom.regex.secret.embedded", secret_embedded)
        span.set_attribute("custom.regex.secret.multi", secret_multi)
        span.set_attribute("custom.regex.acct", ACCOUNT_ID)
        span.set_attribute("custom.regex.acct.embedded", acct_embedded)
        span.set_attribute("custom.regex.acct.multi", acct_multi)
        return jsonify(
            {
                "endpoint": "/span/custom-regex",
                "span": "pii.custom_regex",
                "attributes": {
                    "custom.regex.secret": SECRET_TOKEN,
                    "custom.regex.secret.embedded": secret_embedded,
                    "custom.regex.secret.multi": secret_multi,
                    "custom.regex.acct": ACCOUNT_ID,
                    "custom.regex.acct.embedded": acct_embedded,
                    "custom.regex.acct.multi": acct_multi,
                },
            }
        ), 200


def _shutdown(signum: int, frame: Any) -> None:
    global _force_exit_timer
    print("SIGTERM received, shutting down gracefully...")

    def _force_exit() -> None:
        print("Could not close connections in time, forcefully shutting down", file=sys.stderr)
        os._exit(1)

    _force_exit_timer = threading.Timer(SHUTDOWN_TIMEOUT_SEC, _force_exit)
    _force_exit_timer.daemon = True
    _force_exit_timer.start()

    if _server is not None:
        _server.shutdown()


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, _shutdown)

    print(f"pii-masking server listening on port {PORT}")

    from werkzeug.serving import make_server

    _server = make_server("0.0.0.0", PORT, app, threaded=True)
    _server.serve_forever()
    if _force_exit_timer is not None:
        _force_exit_timer.cancel()
    print("HTTP server closed")
    sys.exit(0)
