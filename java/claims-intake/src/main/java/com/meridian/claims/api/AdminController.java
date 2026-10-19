package com.meridian.claims.api;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.meridian.claims.config.FeatureFlags;

@RestController
public class AdminController {
    private final FeatureFlags flags;

    public AdminController(FeatureFlags flags) {
        this.flags = flags;
    }

    @PostMapping("/admin/features/fraud-ring-detection")
    public Map<String, Object> setFraudRingDetection(@RequestParam("enabled") boolean enabled) {
        flags.setFraudRingDetection(enabled);
        return features();
    }

    @GetMapping("/admin/features")
    public Map<String, Object> features() {
        return Map.of("fraudRingDetection", flags.fraudRingDetection());
    }

    @GetMapping("/health")
    public String health() {
        return "ok";
    }
}
