package com.stacks.billing;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
public class BillingController {

    @Autowired
    private JdbcTemplate jdbc;

    @PostConstruct
    public void init() {
        jdbc.execute(
            "CREATE TABLE IF NOT EXISTS billing (" +
            "id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, " +
            "amount NUMERIC(10,2) NOT NULL, charged_at TIMESTAMPTZ DEFAULT NOW())"
        );
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "healthy");
        body.put("stack", "postgres");
        body.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/charge")
    public ResponseEntity<Map<String, Object>> charge(@RequestBody Map<String, Object> payload) {
        String userId = String.valueOf(payload.getOrDefault("userId", "unknown"));
        double amount = Double.parseDouble(String.valueOf(payload.getOrDefault("amount", "0")));
        Integer id = jdbc.queryForObject(
                "INSERT INTO billing (user_id, amount) VALUES (?, ?) RETURNING id",
                Integer.class, userId, amount);
        System.out.println("[billing] charged user=" + userId + " amount=" + amount);
        Map<String, Object> body = new HashMap<>();
        body.put("billingId", id);
        body.put("userId", userId);
        body.put("amount", amount);
        return ResponseEntity.ok(body);
    }
}
