package com.stacks.processor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@RestController
public class ProcessorController {
    private final AtomicInteger processed = new AtomicInteger(0);
    private final AtomicInteger relayed = new AtomicInteger(0);
    private final RestTemplate http = new RestTemplate();

    @Value("${analytics.url:http://analytics-python:8080}")
    private String analyticsUrl;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "healthy");
        body.put("stack", "kafka");
        body.put("processed", processed.get());
        body.put("relayed", relayed.get());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/relay")
    public ResponseEntity<Map<String, Object>> relay(@RequestBody Map<String, String> payload) {
        relayed.incrementAndGet();
        System.out.println("[relay] " + payload);
        Map<String, Object> body = new HashMap<>();
        body.put("relayed", true);
        body.put("payload", payload);
        return ResponseEntity.ok(body);
    }

    public void onKafkaMessage(String message) {
        processed.incrementAndGet();
        System.out.println("[processor] consumed: " + message);
        try {
            http.postForEntity(analyticsUrl + "/record", Map.of("message", message), Map.class);
        } catch (Exception e) {
            System.err.println("[processor] analytics call failed: " + e.getMessage());
        }
    }
}

@Component
class KafkaConsumer {
    private final ProcessorController controller;

    KafkaConsumer(ProcessorController controller) {
        this.controller = controller;
    }

    @KafkaListener(topics = "${kafka.topic:stacks-events}", groupId = "${kafka.group-id:processor-java}")
    public void listen(String message) {
        controller.onKafkaMessage(message);
    }
}
