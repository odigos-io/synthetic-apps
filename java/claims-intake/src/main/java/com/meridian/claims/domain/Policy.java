package com.meridian.claims.domain;

public record Policy(String policyNumber, String tenantId, long coverageLimitCents, long deductibleCents, boolean active) {
}
