package com.example.log4shell;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class Log4ShellController {

    private static final Logger logger = LogManager.getLogger(Log4ShellController.class);

    private final ProductRepository productRepository;

    public Log4ShellController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", productRepository.isHealthy() ? "healthy" : "degraded");
        response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return ResponseEntity.ok(response);
    }

    /**
     * Product catalog search backed by PostgreSQL.
     * Classic Log4Shell vector: user-controlled input logged without sanitization.
     */
    @GetMapping("/api/search")
    public ResponseEntity<Map<String, Object>> search(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String category,
            HttpServletRequest request) {
        String userAgent = request.getHeader("User-Agent");
        if (userAgent == null) {
            userAgent = "";
        }

        logger.info("Search request: query={} category={} userAgent={}", q, category, userAgent);

        List<Product> results = productRepository.search(q, category);

        Map<String, Object> response = new HashMap<>();
        response.put("query", q);
        response.put("category", category);
        response.put("count", results.size());
        response.put("results", results);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/")
    public ResponseEntity<Map<String, String>> root() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Log4Shell demo app (CVE-2021-44228)");
        response.put("endpoint", "/api/search?q=&category=");
        return ResponseEntity.ok(response);
    }
}
