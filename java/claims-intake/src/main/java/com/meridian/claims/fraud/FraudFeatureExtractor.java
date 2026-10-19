package com.meridian.claims.fraud;

import org.springframework.stereotype.Component;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.ClaimSubmission;
import com.meridian.claims.domain.Policy;

/** Builds the model's feature vector from the submission and the policyholder's claim history. */
@Component
public class FraudFeatureExtractor {
    public static final int FEATURES = 16;

    private final int work = Knobs.intEnv("FEATURE_WORK", 2_000_000);

    public double[] extractFeatures(ClaimSubmission submission, Policy policy) {
        double[] f = new double[FEATURES];
        long x = (submission.amountCents() ^ policy.policyNumber().hashCode()) | 1;
        for (int i = 0; i < work; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
            f[i & (FEATURES - 1)] += (x & 0xff) / 255.0;
        }
        f[0] = (double) submission.amountCents() / policy.coverageLimitCents();
        f[1] = submission.attachments();
        return f;
    }
}
