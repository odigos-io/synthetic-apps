package com.meridian.claims.store;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Repository;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.Claim;
import com.meridian.claims.domain.ClaimStatus;
import com.meridian.claims.domain.Tenants;

/**
 * In-memory claim store seeded with CLM-1..CLM-SEEDED so status lookups and
 * approvals always hit. New submissions take ids above the seed range and wrap,
 * so memory stays bounded under constant load.
 */
@Repository
public class ClaimRepository {
    public static final int SEEDED = 300;
    private static final int MAX_SUBMITTED = 5_000;

    private final Map<String, Claim> claims = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();
    private final int work = Knobs.intEnv("CLAIM_STORE_WORK", 250_000);

    public ClaimRepository() {
        for (int n = 1; n <= SEEDED; n++) {
            String id = "CLM-" + n;
            int policy = PolicyRepository.FIRST_POLICY + (n * 3) % PolicyRepository.POLICY_COUNT;
            claims.put(id, new Claim(id, Tenants.forSeed(n), "POL-" + policy, "tok_seed_" + n,
                    150_000L + n * 1_250L, n % 2 == 0 ? "AUTO" : "PROPERTY", n % 4, 0.1, ClaimStatus.RECEIVED, 0));
        }
    }

    public String nextId() {
        return "CLM-" + (SEEDED + 1 + sequence.getAndIncrement() % MAX_SUBMITTED);
    }

    public Claim save(Claim claim) {
        long x = claim.id().hashCode() | 1;
        for (int i = 0; i < work; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
        }
        claims.put(claim.id(), claim);
        return x == 0 ? null : claim;
    }

    public Claim findById(String id) {
        long x = id.hashCode() | 1;
        for (int i = 0; i < work; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
        }
        Claim c = claims.get(id);
        return x == 0 ? null : c;
    }
}
