package com.meridian.claims.fraud;

import org.springframework.stereotype.Service;

import com.meridian.claims.config.FeatureFlags;
import com.meridian.claims.domain.ClaimSubmission;
import com.meridian.claims.domain.Policy;

@Service
public class FraudScoringEngine {
    private final FraudFeatureExtractor extractor;
    private final FraudModel model;
    private final FraudRingDetector ringDetector;
    private final FeatureFlags flags;

    public FraudScoringEngine(FraudFeatureExtractor extractor, FraudModel model, FraudRingDetector ringDetector,
            FeatureFlags flags) {
        this.extractor = extractor;
        this.model = model;
        this.ringDetector = ringDetector;
        this.flags = flags;
    }

    public double scoreClaim(ClaimSubmission submission, Policy policy) {
        double[] features = extractor.extractFeatures(submission, policy);
        double score = model.predict(features);
        if (flags.fraudRingDetection()) {
            score = Math.max(score, ringDetector.detectRings(submission));
        }
        return score;
    }
}
