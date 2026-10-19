package com.meridian.claims.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.Claim;

/**
 * Checks the adjuster's approval authority against the claim amount. Adjusters
 * whose id starts with "senior-" may approve any amount; others are capped.
 */
@Component
public class AdjusterAuthorizer {
    private static final long JUNIOR_LIMIT_CENTS = 300_000L;

    private final int work = Knobs.intEnv("AUTHORIZE_WORK", 600_000);

    public boolean authorizeApproval(String adjusterId, Claim claim) {
        if (adjusterId == null || adjusterId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "missing adjuster id");
        }
        long x = adjusterId.hashCode() ^ claim.amountCents() | 1;
        for (int i = 0; i < work; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
        }
        return x != 0 && (adjusterId.startsWith("senior-") || claim.amountCents() <= JUNIOR_LIMIT_CENTS);
    }
}
