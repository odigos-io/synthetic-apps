package com.example.headsampling;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.PostConstruct;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HeadSamplingController {

    private static final int PORT = 8080;
    private static final long START_TIME_MS = System.currentTimeMillis();
    private static final long STARTUP_DELAY_MS = 10000;
    private static final long READY_DELAY_MS = 12000;

    @PostConstruct
    public void logStartup() {
        System.out.println("head-sampling server running at http://127.0.0.1:" + PORT + "/");
        if (simulateStartupDelay()) {
            System.out.println("Startup probe will pass after " + (STARTUP_DELAY_MS / 1000) + "s");
            System.out.println("Readiness probe will pass after " + (READY_DELAY_MS / 1000) + "s");
        } else {
            System.out.println("Startup delay simulation is disabled");
        }
    }

    private static boolean simulateStartupDelay() {
        return "true".equalsIgnoreCase(System.getenv("SIMULATE_STARTUP_DELAY"));
    }

    private static long elapsedMs() {
        return System.currentTimeMillis() - START_TIME_MS;
    }

    @GetMapping("/healthz/startup")
    public ResponseEntity<Map<String, Object>> healthStartup() {
        if (!simulateStartupDelay()) {
            return ResponseEntity.ok(json("status", "started", "simulated", false));
        }
        long elapsed = elapsedMs();
        if (elapsed >= STARTUP_DELAY_MS) {
            return ResponseEntity.ok(json("status", "started", "elapsed_ms", elapsed));
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(json("status", "starting", "remaining_ms", STARTUP_DELAY_MS - elapsed));
    }

    @GetMapping("/healthz/ready")
    public ResponseEntity<Map<String, Object>> healthReady() {
        if (!simulateStartupDelay()) {
            return ResponseEntity.ok(json("status", "ready", "simulated", false));
        }
        long elapsed = elapsedMs();
        if (elapsed >= READY_DELAY_MS) {
            return ResponseEntity.ok(json("status", "ready", "elapsed_ms", elapsed));
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(json("status", "not_ready", "remaining_ms", READY_DELAY_MS - elapsed));
    }

    @GetMapping("/healthz/live")
    public Map<String, Object> healthLive() {
        return json("status", "alive");
    }

    @GetMapping("/healthz")
    public Map<String, Object> healthz() {
        return json("status", "healthy");
    }

    @GetMapping("/sampling/percentage/no-rule")
    public Map<String, Object> samplingNoRule() {
        return json(
                "endpoint", "/sampling/percentage/no-rule",
                "description", "no sampling rule matches this endpoint");
    }

    @GetMapping("/sampling/percentage/sampled-0")
    public Map<String, Object> sampled0() {
        return json(
                "endpoint", "/sampling/percentage/sampled-0",
                "description", "sampling rule with 0% rate");
    }

    @GetMapping("/sampling/percentage/sampled-50")
    public Map<String, Object> sampled50() {
        return json(
                "endpoint", "/sampling/percentage/sampled-50",
                "description", "sampling rule with 50% rate");
    }

    @GetMapping("/sampling/percentage/sampled-100")
    public Map<String, Object> sampled100() {
        return json(
                "endpoint", "/sampling/percentage/sampled-100",
                "description", "sampling rule with 100% rate");
    }

    @GetMapping("/sampling/percentage/sampled-fallback")
    public Map<String, Object> sampledFallback() {
        return json(
                "endpoint", "/sampling/percentage/sampled-fallback",
                "description", "sampling rule with no percentage, falls back to 0%");
    }

    @GetMapping("/sampling/route/prefix")
    public Map<String, Object> routePrefix() {
        return json(
                "endpoint", "/sampling/route/prefix",
                "description", "route prefix sampling rule with 50% rate");
    }

    @GetMapping("/sampling/route/prefix/part-one")
    public Map<String, Object> routePrefixPartOne() {
        return json(
                "endpoint", "/sampling/route/prefix/part-one",
                "description", "matches the /sampling/route/prefix sampling rule");
    }

    @GetMapping("/sampling/route/prefix/part-one/part-two")
    public Map<String, Object> routePrefixPartTwo() {
        return json(
                "endpoint", "/sampling/route/prefix/part-one/part-two",
                "description", "matches the /sampling/route/prefix sampling rule with more route parts");
    }

    @GetMapping("/sampling/route/exact/{itemId}")
    public Map<String, Object> routeExactOne(@PathVariable String itemId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("endpoint", "/sampling/route/exact/:itemId");
        m.put("item_id", itemId);
        m.put("description", "exact sampling rule for a templated route");
        return m;
    }

    @GetMapping("/sampling/route/exact/{itemId}/details/{detailId}")
    public Map<String, Object> routeExactTwo(
            @PathVariable String itemId, @PathVariable String detailId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("endpoint", "/sampling/route/exact/:itemId/details/:detailId");
        m.put("item_id", itemId);
        m.put("detail_id", detailId);
        m.put("description", "exact sampling rule for a templated route with multiple parameters");
        return m;
    }

    @GetMapping("/http-match/control/no-rule")
    public Map<String, Object> httpMatchControl() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", "control");
        m.put("endpoint", "/http-match/control/no-rule");
        m.put("description", "no sampling rule targets this path; traces follow default pipeline behavior");
        return m;
    }

    @GetMapping("/http-match/exact/target")
    public Map<String, Object> httpMatchExactTarget() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", "exact_route");
        m.put("endpoint", "/http-match/exact/target");
        m.put("description", "exact HTTP route match (full literal path)");
        return m;
    }

    @PostMapping("/http-match/exact/post-target")
    public Map<String, Object> httpMatchExactPost() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", "exact_route_post");
        m.put("endpoint", "/http-match/exact/post-target");
        m.put("description", "POST-only exact path for client outbound tests");
        return m;
    }

    @GetMapping("/http-match/prefix/segment")
    public Map<String, Object> httpMatchPrefixSegment() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", "prefix_route");
        m.put("endpoint", "/http-match/prefix/segment");
        m.put("description", "prefix HTTP route match (first segment after /http-match/prefix)");
        return m;
    }

    @GetMapping("/http-match/prefix/segment/nested")
    public Map<String, Object> httpMatchPrefixNested() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", "prefix_route");
        m.put("endpoint", "/http-match/prefix/segment/nested");
        m.put("description", "prefix HTTP route match (deeper path under the same static prefix)");
        return m;
    }

    @GetMapping("/http-match/texact/{resourceId}")
    public Map<String, Object> httpMatchTexact(@PathVariable String resourceId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", "templatized_exact");
        m.put("endpoint", "/http-match/texact/:resourceId");
        m.put("resource_id", resourceId);
        m.put("description", "templatized exact route (one dynamic segment)");
        return m;
    }

    @GetMapping("/http-match/tprefix/{tenantId}/items")
    public Map<String, Object> httpMatchTprefixItems(@PathVariable String tenantId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", "templatized_prefix");
        m.put("endpoint", "/http-match/tprefix/:tenantId/items");
        m.put("tenant_id", tenantId);
        m.put("description", "templatized prefix (tenant/items)");
        return m;
    }

    @GetMapping("/http-match/tprefix/{tenantId}/items/{itemId}")
    public Map<String, Object> httpMatchTprefixItem(
            @PathVariable String tenantId, @PathVariable String itemId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", "templatized_prefix");
        m.put("endpoint", "/http-match/tprefix/:tenantId/items/:itemId");
        m.put("tenant_id", tenantId);
        m.put("item_id", itemId);
        m.put("description", "templatized prefix with extra path under items");
        return m;
    }

    private static Map<String, Object> json(Object... keysAndValues) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            m.put((String) keysAndValues[i], keysAndValues[i + 1]);
        }
        return m;
    }
}
