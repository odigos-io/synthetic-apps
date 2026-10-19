package com.meridian.claims.payout;

import org.springframework.stereotype.Component;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.Claim;
import com.meridian.claims.domain.Policy;

/** Per-category deductible schedule. The loop stands in for walking the rate tables. */
@Component
public class DeductibleRules {
    private final int work = Knobs.intEnv("DEDUCTIBLE_WORK", 700_000);

    public long applyDeductible(Claim claim, Policy policy) {
        long x = claim.category().hashCode() ^ policy.deductibleCents() | 1;
        for (int i = 0; i < work; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
        }
        long deductible = "AUTO".equals(claim.category()) ? policy.deductibleCents() : policy.deductibleCents() * 2;
        return x == 0 ? 0 : Math.max(0, claim.amountCents() - deductible);
    }
}
