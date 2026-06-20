package com.example.tailsampling;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

@RestController
public class TailSamplingController {

    private static final int PORT = 8080;
    private static final Map<String, Integer> DURATIONS = new LinkedHashMap<String, Integer>() {{
        put("short", 50);
        put("medium", 750);
        put("long", 1500);
    }};

    private final RestTemplate restTemplate;
    private final AtomicBoolean alternateErrorNext = new AtomicBoolean(false);

    public TailSamplingController(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @PostConstruct
    public void logStartup() {
        System.out.println("tail-sampling server running at http://127.0.0.1:" + PORT + "/");
    }

    @GetMapping("/healthz")
    public Map<String, Object> healthz() {
        return json("status", "healthy");
    }

    @GetMapping("/sampling/tail/no-rule")
    public ResponseEntity<Map<String, Object>> tailNoRule(
            @RequestParam(required = false) String error) {
        return sendScenarioResponse(
                json(
                        "endpoint", "/sampling/tail/no-rule",
                        "description", "baseline traffic sampled through the 10% cost-reduction rule"),
                error);
    }

    @GetMapping("/sampling/tail/error")
    public ResponseEntity<Map<String, Object>> tailError(
            @RequestParam(required = false) String error) {
        return sendScenarioResponse(
                json(
                        "endpoint", "/sampling/tail/error",
                        "description", "tail-sampling error scenario; add ?error=true to force HTTP 500"),
                error);
    }

    @GetMapping("/sampling/tail/duration/short")
    public ResponseEntity<Map<String, Object>> tailDurationShort(
            @RequestParam(required = false) String error) {
        return sendScenarioResponse(
                scenarioWithDelay(
                        "/sampling/tail/duration/short",
                        "short request duration, sampled through the 10% cost-reduction rule",
                        DURATIONS.get("short")),
                error);
    }

    @GetMapping("/sampling/tail/duration/medium")
    public ResponseEntity<Map<String, Object>> tailDurationMedium(
            @RequestParam(required = false) String error) {
        return sendScenarioResponse(
                scenarioWithDelay(
                        "/sampling/tail/duration/medium",
                        "medium request duration above 500ms, sampled at 50%",
                        DURATIONS.get("medium")),
                error);
    }

    @GetMapping("/sampling/tail/duration/long")
    public ResponseEntity<Map<String, Object>> tailDurationLong(
            @RequestParam(required = false) String error) {
        return sendScenarioResponse(
                scenarioWithDelay(
                        "/sampling/tail/duration/long",
                        "long request duration above 1000ms, sampled at 100%",
                        DURATIONS.get("long")),
                error);
    }

    @GetMapping("/sampling/tail/hops")
    public ResponseEntity<Map<String, Object>> tailHops(
            @RequestParam(defaultValue = "1") int hops,
            @RequestParam(required = false) String error) {
        return handleHops(
                "/sampling/tail/hops",
                hops,
                error,
                true,
                "final hop returns success or error based on the error query parameter",
                "hop made an outgoing HTTP request to itself; downstream status is returned to the client");
    }

    @GetMapping("/sampling/tail/hops/non-propagating-error")
    public ResponseEntity<Map<String, Object>> tailHopsNonPropagatingError(
            @RequestParam(defaultValue = "1") int hops,
            @RequestParam(required = false) String error) {
        return handleHops(
                "/sampling/tail/hops/non-propagating-error",
                hops,
                error,
                false,
                "final hop returns success or error based on the error query parameter",
                "hop made an outgoing HTTP request to itself; only the final hop reflects a forced error on the client response");
    }

    @GetMapping("/ok")
    public Map<String, Object> ok() {
        return json(
                "endpoint", "/ok",
                "description", "successful baseline request for cost-reduction tail sampling");
    }

    @GetMapping("/error")
    public ResponseEntity<Map<String, Object>> error() {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(json(
                        "endpoint", "/error",
                        "description", "handler always returns HTTP 500 for error-focused tail sampling"));
    }

    @GetMapping("/alternate")
    public ResponseEntity<Map<String, Object>> alternate() {
        boolean isError = alternateErrorNext.getAndSet(!alternateErrorNext.get());
        HttpStatus status = isError ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.OK;
        Map<String, Object> body = json(
                "endpoint", "/alternate",
                "description", "alternates HTTP 200 and 500 on each request (in-process toggle)",
                "returned_error", isError,
                "status_code", status.value());
        return ResponseEntity.status(status).body(body);
    }

    @GetMapping("/hops")
    public ResponseEntity<Map<String, Object>> internalErrorHops(
            @RequestParam(defaultValue = "1") int hops) {
        return handleInternalErrorHops("/hops", hops);
    }

    @GetMapping("/duration")
    public ResponseEntity<Map<String, Object>> duration(
            @RequestParam(required = false) String ms,
            @RequestParam(required = false) String error) {
        return sendScenarioResponse(
                scenarioWithDelay(
                        "/duration",
                        "response delayed by ?ms= query parameter",
                        parseDelayMs(ms)),
                error);
    }

    @GetMapping("/duration/short")
    public ResponseEntity<Map<String, Object>> durationShort(
            @RequestParam(required = false) String error) {
        return sendScenarioResponse(
                scenarioWithDelay(
                        "/duration/short",
                        "short request duration (~50ms), sampled through the 10% cost-reduction rule",
                        DURATIONS.get("short")),
                error);
    }

    @GetMapping("/duration/medium")
    public ResponseEntity<Map<String, Object>> durationMedium(
            @RequestParam(required = false) String error) {
        return sendScenarioResponse(
                scenarioWithDelay(
                        "/duration/medium",
                        "medium request duration (~750ms), sampled at least 50%",
                        DURATIONS.get("medium")),
                error);
    }

    @GetMapping("/duration/long")
    public ResponseEntity<Map<String, Object>> durationLong(
            @RequestParam(required = false) String error) {
        return sendScenarioResponse(
                scenarioWithDelay(
                        "/duration/long",
                        "long request duration (~1500ms), sampled at 100%",
                        DURATIONS.get("long")),
                error);
    }

    private ResponseEntity<Map<String, Object>> sendScenarioResponse(
            Map<String, Object> scenario,
            String errorParam) {
        boolean isError = shouldReturnError(errorParam);
        HttpStatus status = isError ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.OK;
        int delayMs = scenario.containsKey("delayMs") ? (Integer) scenario.get("delayMs") : 0;

        sleep(delayMs);

        Map<String, Object> body = new LinkedHashMap<>(scenario);
        body.put("simulated_duration_ms", delayMs);
        body.put("forced_error", isError);
        body.put("status_code", status.value());
        return ResponseEntity.status(status).body(body);
    }

    private ResponseEntity<Map<String, Object>> handleHops(
            String path,
            int hops,
            String errorParam,
            boolean propagateError,
            String finalHopDescription,
            String hopDescription) {
        int normalizedHops = normalizeHops(hops);
        boolean isError = shouldReturnError(errorParam);
        HttpStatus status;
        if (propagateError) {
            status = isError ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.OK;
        } else {
            status = (normalizedHops == 1 && isError)
                    ? HttpStatus.INTERNAL_SERVER_ERROR
                    : HttpStatus.OK;
        }

        if (normalizedHops == 1) {
            Map<String, Object> body = json(
                    "endpoint", path,
                    "description", finalHopDescription,
                    "hops_remaining", normalizedHops,
                    "forced_error", isError,
                    "status_code", status.value(),
                    "error_propagates_to_client", propagateError);
            return ResponseEntity.status(status).body(body);
        }

        String nextPath = path + "?hops=" + (normalizedHops - 1) + (isError ? "&error=true" : "");
        try {
            DownstreamResponse downstream = httpGet(nextPath);
            Map<String, Object> body = json(
                    "endpoint", path,
                    "description", hopDescription,
                    "hops_remaining", normalizedHops,
                    "next_path", nextPath,
                    "forced_error", isError,
                    "status_code", status.value(),
                    "error_propagates_to_client", propagateError,
                    "downstream_status_code", downstream.statusCode,
                    "downstream_body", downstream.body);
            return ResponseEntity.status(status).body(body);
        } catch (RestClientException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(json("endpoint", path, "error", e.getMessage()));
        }
    }

    private ResponseEntity<Map<String, Object>> handleInternalErrorHops(String path, int hops) {
        int normalizedHops = normalizeHops(hops);

        if (normalizedHops == 1) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(json(
                            "endpoint", path,
                            "description", "final hop always returns HTTP 500 (error on internal span only)",
                            "hops_remaining", normalizedHops,
                            "status_code", 500));
        }

        String nextPath = path + "?hops=" + (normalizedHops - 1);
        try {
            DownstreamResponse downstream = httpGet(nextPath);
            Map<String, Object> body = json(
                    "endpoint", path,
                    "description", "self HTTP hop; last hop is always 500, caller always gets HTTP 200",
                    "hops_remaining", normalizedHops,
                    "next_path", nextPath,
                    "status_code", 200,
                    "downstream_status_code", downstream.statusCode,
                    "downstream_body", downstream.body);
            return ResponseEntity.ok(body);
        } catch (RestClientException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(json("endpoint", path, "error", e.getMessage()));
        }
    }

    private DownstreamResponse httpGet(String path) {
        String url = "http://127.0.0.1:" + PORT + path;
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
        return new DownstreamResponse(response.getStatusCodeValue(), response.getBody());
    }

    private static boolean shouldReturnError(String errorParam) {
        return "true".equals(errorParam) || "1".equals(errorParam);
    }

    private static int normalizeHops(int hops) {
        return hops < 1 ? 1 : hops;
    }

    private static int parseDelayMs(String raw) {
        if (raw == null || raw.isEmpty()) {
            return 0;
        }
        try {
            int ms = Integer.parseInt(raw, 10);
            return Math.max(ms, 0);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static Map<String, Object> scenarioWithDelay(String endpoint, String description, int delayMs) {
        Map<String, Object> scenario = json("endpoint", endpoint, "description", description);
        scenario.put("delayMs", delayMs);
        return scenario;
    }

    private static void sleep(int delayMs) {
        if (delayMs <= 0) {
            return;
        }
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static Map<String, Object> json(Object... keysAndValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            map.put((String) keysAndValues[i], keysAndValues[i + 1]);
        }
        return map;
    }

    private static final class DownstreamResponse {
        private final int statusCode;
        private final String body;

        private DownstreamResponse(int statusCode, String body) {
            this.statusCode = statusCode;
            this.body = body;
        }
    }
}
