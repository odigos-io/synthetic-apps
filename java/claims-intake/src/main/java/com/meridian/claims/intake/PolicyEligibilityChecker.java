package com.meridian.claims.intake;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.ClaimSubmission;
import com.meridian.claims.domain.Policy;
import com.meridian.claims.store.PolicyRepository;

/** Rejects claims against unknown, lapsed, or other-tenant policies, and claims above the coverage limit. */
@Component
public class PolicyEligibilityChecker {
    private final PolicyRepository policies;
    private final int work = Knobs.intEnv("ELIGIBILITY_WORK", 400_000);

    public PolicyEligibilityChecker(PolicyRepository policies) {
        this.policies = policies;
    }

    public Policy validateCoverage(String tenantId, ClaimSubmission submission) {
        Policy policy = policies.loadPolicy(submission.policyNumber());
        if (policy == null || !policy.tenantId().equals(tenantId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown policy");
        }
        long x = submission.amountCents() | 1;
        for (int i = 0; i < work; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
        }
        if (x == 0 || !policy.active()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "policy is not active");
        }
        if (submission.amountCents() > policy.coverageLimitCents()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "amount exceeds coverage limit");
        }
        return policy;
    }
}
