package com.stacks.notifier;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
public class NotifierController {

    @Autowired
    private StringRedisTemplate redis;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "healthy");
        body.put("stack", "redis");
        body.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/notify")
    public ResponseEntity<Map<String, Object>> notify(@RequestBody Map<String, String> payload) {
        String key = payload.getOrDefault("key", "unknown");
        String value = payload.getOrDefault("value", "");
        String msg = key + "=" + value;
        redis.opsForList().leftPush("notifications", msg);
        System.out.println("[notify] queued " + msg);
        Map<String, Object> body = new HashMap<>();
        body.put("queued", true);
        body.put("message", msg);
        return ResponseEntity.ok(body);
    }
}
