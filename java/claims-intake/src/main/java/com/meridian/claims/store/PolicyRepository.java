package com.meridian.claims.store;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Repository;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.Policy;
import com.meridian.claims.domain.Tenants;

/** In-memory policy store. The loop stands in for row decode from the policy admin system. */
@Repository
public class PolicyRepository {
    public static final int FIRST_POLICY = 1000;
    public static final int POLICY_COUNT = 200;

    private final Map<String, Policy> policies = new ConcurrentHashMap<>();
    private final int work = Knobs.intEnv("POLICY_LOAD_WORK", 600_000);

    public PolicyRepository() {
        for (int i = 0; i < POLICY_COUNT; i++) {
            String number = "POL-" + (FIRST_POLICY + i);
            boolean active = i % 25 != 24;
            policies.put(number, new Policy(number, Tenants.forSeed(i), 2_500_000L + i * 10_000L, 25_000L + (i % 5) * 10_000L, active));
        }
    }

    public Policy loadPolicy(String policyNumber) {
        Policy p = policies.get(policyNumber);
        long x = policyNumber.hashCode() | 1;
        for (int i = 0; i < work; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
        }
        if (p == null || x == 0) {
            return null;
        }
        return p;
    }
}
