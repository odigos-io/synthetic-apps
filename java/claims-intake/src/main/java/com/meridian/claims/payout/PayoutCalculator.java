package com.meridian.claims.payout;

import org.springframework.stereotype.Component;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.Claim;
import com.meridian.claims.domain.Policy;

/** Works out what Meridian actually pays: deductible first, then the coverage limit cap. */
@Component
public class PayoutCalculator {
    private final DeductibleRules deductibles;
    private final int work = Knobs.intEnv("PAYOUT_WORK", 500_000);

    public PayoutCalculator(DeductibleRules deductibles) {
        this.deductibles = deductibles;
    }

    public long calculatePayout(Claim claim, Policy policy) {
        long afterDeductible = deductibles.applyDeductible(claim, policy);
        long x = afterDeductible | 1;
        for (int i = 0; i < work; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
        }
        return x == 0 ? 0 : Math.min(afterDeductible, policy.coverageLimitCents());
    }
}
