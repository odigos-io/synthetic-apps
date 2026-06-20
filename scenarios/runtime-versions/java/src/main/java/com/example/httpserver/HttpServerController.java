package com.example.httpserver;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@RestController
public class HttpServerController {

    @GetMapping("/static/success")
    public String staticSuccess() {
        System.out.println("got request for static/success, replying hello-world");
        return "Hello, World!";
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        System.out.println("health check requested");
        Map<String, String> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/")
    public ResponseEntity<Map<String, String>> root() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Java HTTP Server is running");
        return ResponseEntity.ok(response);
    }
} 