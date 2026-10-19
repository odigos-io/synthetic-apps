package com.meridian.claims.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.Claim;

/** Stops one partner from reading another partner's claims. The loop stands in for the entitlement lookup. */
@Component
public class TenantGuard {
    private final int work = Knobs.intEnv("TENANT_GUARD_WORK", 350_000);

    public void enforceTenantIsolation(String callerTenant, Claim claim) {
        long x = (callerTenant == null ? 0 : callerTenant.hashCode()) | 1;
        for (int i = 0; i < work; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
        }
        if (x == 0 || callerTenant == null || !callerTenant.equals(claim.tenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "claim belongs to another tenant");
        }
    }
}
