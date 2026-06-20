import os
import signal
import sys
import threading
import time
import urllib.error
import urllib.request
from typing import Any

from flask import Flask, jsonify, request

app = Flask(__name__)

PORT = 8080
DURATIONS = {"short": 50, "medium": 750, "long": 1500}
SHUTDOWN_TIMEOUT_SEC = 10

_alternate_error_next = False
_server = None
_force_exit_timer: threading.Timer | None = None


@app.after_request
def _log_request(response):
    query = f"?{request.query_string.decode()}" if request.query_string else ""
    print(f"{request.method} {request.path}{query} -> {response.status_code}", flush=True)
    return response


def _should_return_error() -> bool:
    err = request.args.get("error")
    return err in ("true", "1")


def _parse_hops() -> int:
    raw = request.args.get("hops")
    if raw is None:
        return 1
    try:
        hops = int(raw, 10)
    except ValueError:
        return 1
    if hops < 1:
        return 1
    return hops


def _parse_delay_ms() -> int:
    raw = request.args.get("ms")
    if raw is None:
        return 0
    try:
        ms = int(raw, 10)
    except ValueError:
        return 0
    if ms < 0:
        return 0
    return ms


def _send_scenario_response(scenario: dict[str, Any]):
    is_error = _should_return_error()
    status_code = 500 if is_error else 200
    delay_ms = scenario.get("delayMs", 0)

    if delay_ms > 0:
        time.sleep(delay_ms / 1000.0)

    return (
        jsonify(
            {
                "endpoint": scenario["endpoint"],
                "description": scenario["description"],
                "simulated_duration_ms": delay_ms,
                "forced_error": is_error,
                "status_code": status_code,
            }
        ),
        status_code,
    )


def _http_get(path: str) -> tuple[int, str]:
    url = f"http://127.0.0.1:{PORT}{path}"
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode()
    except urllib.error.URLError as err:
        raise RuntimeError(str(err.reason)) from err


def _route_endpoint(path: str) -> str:
    return "route_" + path.strip("/").replace("/", "_").replace("-", "_")


def _register_hops_route(
    path: str,
    *,
    propagate_error: bool,
    final_hop_description: str,
    hop_description: str,
) -> None:
    @app.get(path, endpoint=_route_endpoint(path))
    def hops_handler():
        hops = _parse_hops()
        is_error = _should_return_error()
        if propagate_error:
            status_code = 500 if is_error else 200
        else:
            status_code = 500 if (hops == 1 and is_error) else 200

        if hops == 1:
            return (
                jsonify(
                    {
                        "endpoint": path,
                        "description": final_hop_description,
                        "hops_remaining": hops,
                        "forced_error": is_error,
                        "status_code": status_code,
                        "error_propagates_to_client": propagate_error,
                    }
                ),
                status_code,
            )

        error_q = "&error=true" if is_error else ""
        next_path = f"{path}?hops={hops - 1}{error_q}"
        try:
            downstream_status, body = _http_get(next_path)
        except RuntimeError as err:
            return jsonify({"endpoint": path, "error": str(err)}), 502

        return (
            jsonify(
                {
                    "endpoint": path,
                    "description": hop_description,
                    "hops_remaining": hops,
                    "next_path": next_path,
                    "forced_error": is_error,
                    "status_code": status_code,
                    "error_propagates_to_client": propagate_error,
                    "downstream_status_code": downstream_status,
                    "downstream_body": body,
                }
            ),
            status_code,
        )


def _register_tail_sampling_scenario_routes() -> None:
    @app.get("/sampling/tail/no-rule")
    def tail_no_rule():
        return _send_scenario_response(
            {
                "endpoint": "/sampling/tail/no-rule",
                "description": "baseline traffic sampled through the 10% cost-reduction rule",
            }
        )

    @app.get("/sampling/tail/error")
    def tail_error():
        return _send_scenario_response(
            {
                "endpoint": "/sampling/tail/error",
                "description": "tail-sampling error scenario; add ?error=true to force HTTP 500",
            }
        )

    @app.get("/sampling/tail/duration/short")
    def tail_duration_short():
        return _send_scenario_response(
            {
                "endpoint": "/sampling/tail/duration/short",
                "description": "short request duration, sampled through the 10% cost-reduction rule",
                "delayMs": DURATIONS["short"],
            }
        )

    @app.get("/sampling/tail/duration/medium")
    def tail_duration_medium():
        return _send_scenario_response(
            {
                "endpoint": "/sampling/tail/duration/medium",
                "description": "medium request duration above 500ms, sampled at 50%",
                "delayMs": DURATIONS["medium"],
            }
        )

    @app.get("/sampling/tail/duration/long")
    def tail_duration_long():
        return _send_scenario_response(
            {
                "endpoint": "/sampling/tail/duration/long",
                "description": "long request duration above 1000ms, sampled at 100%",
                "delayMs": DURATIONS["long"],
            }
        )

    _register_hops_route(
        "/sampling/tail/hops",
        propagate_error=True,
        final_hop_description="final hop returns success or error based on the error query parameter",
        hop_description="hop made an outgoing HTTP request to itself; downstream status is returned to the client",
    )
    _register_hops_route(
        "/sampling/tail/hops/non-propagating-error",
        propagate_error=False,
        final_hop_description="final hop returns success or error based on the error query parameter",
        hop_description="hop made an outgoing HTTP request to itself; only the final hop reflects a forced error on the client response",
    )


def _register_internal_error_hops_route(path: str) -> None:
    @app.get(path, endpoint=_route_endpoint(path))
    def internal_error_hops():
        hops = _parse_hops()

        if hops == 1:
            return (
                jsonify(
                    {
                        "endpoint": path,
                        "description": "final hop always returns HTTP 500 (error on internal span only)",
                        "hops_remaining": hops,
                        "status_code": 500,
                    }
                ),
                500,
            )

        next_path = f"{path}?hops={hops - 1}"
        try:
            downstream_status, body = _http_get(next_path)
        except RuntimeError as err:
            return jsonify({"endpoint": path, "error": str(err)}), 502

        return (
            jsonify(
                {
                    "endpoint": path,
                    "description": "self HTTP hop; last hop is always 500, caller always gets HTTP 200",
                    "hops_remaining": hops,
                    "next_path": next_path,
                    "status_code": 200,
                    "downstream_status_code": downstream_status,
                    "downstream_body": body,
                }
            ),
            200,
        )


def _register_tail_error_scenario_routes() -> None:
    @app.get("/ok")
    def ok():
        return (
            jsonify(
                {
                    "endpoint": "/ok",
                    "description": "successful baseline request for cost-reduction tail sampling",
                }
            ),
            200,
        )

    @app.get("/error")
    def error():
        return (
            jsonify(
                {
                    "endpoint": "/error",
                    "description": "handler always returns HTTP 500 for error-focused tail sampling",
                }
            ),
            500,
        )

    @app.get("/alternate")
    def alternate():
        global _alternate_error_next
        is_error = _alternate_error_next
        _alternate_error_next = not _alternate_error_next
        status_code = 500 if is_error else 200
        return (
            jsonify(
                {
                    "endpoint": "/alternate",
                    "description": "alternates HTTP 200 and 500 on each request (in-process toggle)",
                    "returned_error": is_error,
                    "status_code": status_code,
                }
            ),
            status_code,
        )

    _register_internal_error_hops_route("/hops")


def _register_tail_duration_scenario_routes() -> None:
    @app.get("/duration")
    def duration():
        delay_ms = _parse_delay_ms()
        return _send_scenario_response(
            {
                "endpoint": "/duration",
                "description": "response delayed by ?ms= query parameter",
                "delayMs": delay_ms,
            }
        )

    @app.get("/duration/short")
    def duration_short():
        return _send_scenario_response(
            {
                "endpoint": "/duration/short",
                "description": "short request duration (~50ms), sampled through the 10% cost-reduction rule",
                "delayMs": DURATIONS["short"],
            }
        )

    @app.get("/duration/medium")
    def duration_medium():
        return _send_scenario_response(
            {
                "endpoint": "/duration/medium",
                "description": "medium request duration (~750ms), sampled at least 50%",
                "delayMs": DURATIONS["medium"],
            }
        )

    @app.get("/duration/long")
    def duration_long():
        return _send_scenario_response(
            {
                "endpoint": "/duration/long",
                "description": "long request duration (~1500ms), sampled at 100%",
                "delayMs": DURATIONS["long"],
            }
        )


@app.get("/healthz")
def healthz():
    return jsonify({"status": "healthy"}), 200


_register_tail_sampling_scenario_routes()
_register_tail_error_scenario_routes()
_register_tail_duration_scenario_routes()


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

    print(f"tail-sampling server running at http://127.0.0.1:{PORT}/")

    from werkzeug.serving import make_server

    _server = make_server("0.0.0.0", PORT, app, threaded=True)
    _server.serve_forever()
    if _force_exit_timer is not None:
        _force_exit_timer.cancel()
    print("HTTP server closed")
    sys.exit(0)
