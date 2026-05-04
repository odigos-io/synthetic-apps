package com.example.httpclient;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
public class HttpClientController {

    @Autowired
    private RestTemplate restTemplate;

    @GetMapping("/call")
    public ResponseEntity<Map<String, Object>> makeHttpCall(
            @RequestParam(value = "url", defaultValue = "http://httpbin.org/get") String url) {
        System.out.println("Received request to make HTTP call to: " + url);
        
        Map<String, Object> response = new HashMap<>();
        try {
            String result = restTemplate.getForObject(url, String.class);
            response.put("status", "success");
            response.put("target_url", url);
            response.put("response", result);
            response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            System.out.println("Successfully made HTTP call to: " + url);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("status", "error");
            response.put("target_url", url);
            response.put("error", e.getMessage());
            response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            System.err.println("Error making HTTP call to " + url + ": " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/call/templated")
    public ResponseEntity<Map<String, Object>> makeTemplatedHttpCall(
            @RequestParam(value = "url") String urlTemplate) {
        System.out.println("Received request to make templated HTTP call with template: " + urlTemplate);
        
        // Generate UUID
        UUID uuid = UUID.randomUUID();
        String uuidString = uuid.toString();
        
        // Replace {uuid} placeholder in the URL template
        String url = urlTemplate.replace("{uuid}", uuidString);
        
        Map<String, Object> response = new HashMap<>();
        try {
            String result = restTemplate.getForObject(url, String.class);
            response.put("status", "success");
            response.put("url_template", urlTemplate);
            response.put("generated_uuid", uuidString);
            response.put("target_url", url);
            response.put("response", result);
            response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            System.out.println("Successfully made HTTP call to: " + url + " (UUID: " + uuidString + ")");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("status", "error");
            response.put("url_template", urlTemplate);
            response.put("generated_uuid", uuidString);
            response.put("target_url", url);
            response.put("error", e.getMessage());
            response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            System.err.println("Error making HTTP call to " + url + ": " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
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
        response.put("message", "Java HTTP Client is running");
        response.put("endpoints", "/call?url=<target_url> - Makes an outgoing HTTP call; /call/templated?url=<template_with_{uuid}> - Makes an HTTP call with generated UUID");
        return ResponseEntity.ok(response);
    }
}
