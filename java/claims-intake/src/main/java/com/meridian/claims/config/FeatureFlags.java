package com.meridian.claims.config;

import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.stereotype.Component;

/**
 * Runtime switches. fraudRingDetection stands in for the 2.4 release: it adds a
 * new code path under fraud scoring without a redeploy, so the interrogation
 * loop sees new call-graph evidence on a transaction it already analyzed.
 */
@Component
public class FeatureFlags {
    private final AtomicBoolean fraudRingDetection =
            new AtomicBoolean(Boolean.parseBoolean(System.getenv("FRAUD_RING_DETECTION")));

    public boolean fraudRingDetection() {
        return fraudRingDetection.get();
    }

    public void setFraudRingDetection(boolean on) {
        fraudRingDetection.set(on);
    }
}
