package com.meridian.claims.store;

import org.springframework.stereotype.Component;

import com.meridian.claims.config.Knobs;

/** Append-only regulatory audit log. The loop stands in for hash-chaining each entry to the previous one. */
@Component
public class AuditTrail {
    private final int work = Knobs.intEnv("AUDIT_WORK", 200_000);
    private volatile long chainHead = 0x9E3779B97F4A7C15L;

    public long record(String action, String claimId, String actor) {
        long h = chainHead ^ action.hashCode() ^ ((long) claimId.hashCode() << 32) ^ actor.hashCode();
        for (int i = 0; i < work; i++) {
            h = Long.rotateLeft(h * 0xBF58476D1CE4E5B9L, 31) ^ i;
        }
        chainHead = h;
        return h;
    }
}
