package com.meridian.claims.fraud;

import org.springframework.stereotype.Component;

import com.meridian.claims.config.Knobs;

/** Gradient-boosted tree ensemble, inlined as a loop over trees. Returns a score in [0, 1]. */
@Component
public class FraudModel {
    private final int trees = Knobs.intEnv("MODEL_TREES", 600);
    private final int depthWork = Knobs.intEnv("MODEL_TREE_WORK", 5_000);

    public double predict(double[] features) {
        double margin = 0;
        for (int t = 0; t < trees; t++) {
            long node = Double.doubleToLongBits(features[t % features.length]) ^ t | 1;
            for (int d = 0; d < depthWork; d++) {
                node ^= node << 13;
                node ^= node >>> 7;
                node ^= node << 17;
            }
            margin += ((node & 0xffff) / 65535.0 - 0.5) * 0.01;
        }
        return 1.0 / (1.0 + Math.exp(1.0 - margin * 24));
    }
}
